/**
 * SEP overrides + `.efs refresh` fanout.
 * Run: npx tsx --test src/efs-sync/meta.test.ts
 */
import test from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import express from "express"
import { WebSocket } from "ws"
import efsSync from "../routes/efs-sync"
import { attachEfsSyncWebSocket } from "./ws"
import { normalizeSep, parseEssaSepOverrides } from "./store"

const allow = (process.env.EFS_SYNC_ALLOW_CIDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
const cidA = allow[0] ? Number(allow[0]) : 111111
const cidB = allow.find((c) => Number(c) !== cidA) ? Number(allow.find((c) => Number(c) !== cidA)) : 222222

function waitFor(pred: () => boolean, ms = 2000): Promise<void> {
    const start = Date.now()
    return new Promise((resolve, reject) => {
        const tick = () => {
            if (pred()) return resolve()
            if (Date.now() - start > ms) return reject(new Error("timeout"))
            setTimeout(tick, 15)
        }
        tick()
    })
}

function collect(ws: WebSocket): any[] {
    const msgs: any[] = []
    ws.on("message", (raw) => {
        try {
            msgs.push(JSON.parse(String(raw)))
        } catch {
            /* ignore */
        }
    })
    return msgs
}

test("normalizeSep keeps a blank depGap and strips nm", () => {
    assert.deepEqual(normalizeSep({ sep: "2.5 nm", dlv: "3 nm", depGap: "" }), {
        sep: "2.5",
        dlv: "3",
        depGap: "",
    })
    assert.equal(normalizeSep({}), undefined)
})

test("parseEssaSepOverrides accepts display strings and rejects junk", () => {
    const ok = parseEssaSepOverrides({ sep: "3 nm", extra: 1 })
    assert.equal(ok.ok, true)
    if (ok.ok) {
        assert.equal(ok.overrides.sep, "3 nm")
        assert.equal("extra" in ok.overrides, false)
    }
    const empty = parseEssaSepOverrides({})
    assert.equal(empty.ok, true)
    if (empty.ok) assert.deepEqual(empty.overrides, {})
    assert.equal(parseEssaSepOverrides({ sep: 3 }).ok, false)
    assert.equal(parseEssaSepOverrides({ depGap: "x".repeat(33) }).ok, false)
    assert.equal(parseEssaSepOverrides(null).ok, false)
    assert.equal(parseEssaSepOverrides([]).ok, false)
})

test("meta overrides persist and reassertAssumed reaches other CIDs only", async () => {
    const app = express()
    app.use(express.json())
    app.use("/efs/sync", efsSync)
    const server = http.createServer(app)
    attachEfsSyncWebSocket(server)
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()))
    const addr = server.address()
    const port = typeof addr === "object" && addr ? addr.port : 0
    const base = `http://127.0.0.1:${port}/efs/sync/local/ZZZZ`
    const wsUrl = (cid: number) => `ws://127.0.0.1:${port}/efs/sync/local/ZZZZ/ws?cid=${cid}`

    const wsA = new WebSocket(wsUrl(cidA))
    const wsB = new WebSocket(wsUrl(cidB))
    const aMsgs = collect(wsA)
    const bMsgs = collect(wsB)

    const put = (cid: number, body: unknown) =>
        fetch(`${base}/meta`, {
            method: "PUT",
            headers: { "content-type": "application/json", "x-vatsim-cid": String(cid) },
            body: JSON.stringify(body),
        })

    try {
        await Promise.all([
            waitFor(() => aMsgs.some((m) => m.type === "snapshot")),
            waitFor(() => bMsgs.some((m) => m.type === "snapshot")),
        ])

        const bare = { sep: "2.5 nm", dlv: "3 nm", depGap: "" }
        const bad = await put(cidA, { essaSep: bare, essaSepOverrides: { sep: 3 } })
        assert.equal(bad.status, 400)
        const long = await put(cidA, { essaSep: bare, essaSepOverrides: { dlv: "n".repeat(33) } })
        assert.equal(long.status, 400)
        const missing = await put(cidA, { essaConfig: "9A" })
        assert.equal(missing.status, 400)

        const aFrom = aMsgs.length
        const bFrom = bMsgs.length
        const ok = await put(cidA, {
            essaSep: bare,
            essaConfig: "9A",
            essaSepOverrides: { sep: "3 nm" },
        })
        assert.equal(ok.status, 200)
        const okBody = await ok.json()
        assert.equal(okBody.essaSep.sep, "2.5")
        assert.equal(okBody.essaSep.dlv, "3")
        assert.equal(okBody.essaSep.depGap, "")
        assert.equal(okBody.essaSepOverrides.sep, "3 nm")
        assert.equal(okBody.meta.essaSepOverrides.sep, "3 nm")
        assert.equal(okBody.essaConfig, "9A")
        assert.equal(okBody.updatedByCid, cidA)

        await waitFor(() => bMsgs.slice(bFrom).some((m) => m.type === "meta"))
        await waitFor(() => aMsgs.slice(aFrom).some((m) => m.type === "meta"))
        const peerMeta = bMsgs.slice(bFrom).find((m) => m.type === "meta")
        const ownMeta = aMsgs.slice(aFrom).find((m) => m.type === "meta")
        assert.equal(peerMeta.meta.essaSep.depGap, "")
        assert.equal(peerMeta.meta.essaSepOverrides.sep, "3 nm")
        assert.equal(peerMeta.updatedByCid, cidA)
        assert.equal(ownMeta.meta.essaSepOverrides.sep, "3 nm")

        const got = await fetch(`${base}/meta`)
        assert.equal(got.status, 200)
        const stored = await got.json()
        assert.equal(stored.meta.essaSepOverrides.sep, "3 nm")
        assert.equal(stored.essaSep.sep, "2.5")
        assert.equal(stored.updatedAt, okBody.updatedAt)

        const kept = await put(cidA, { essaSep: { sep: "4", dlv: "3", depGap: "" } })
        assert.equal(kept.status, 200)
        const keptBody = await kept.json()
        assert.equal(keptBody.essaSep.sep, "4")
        assert.equal(keptBody.essaSepOverrides.sep, "3 nm")
        assert.equal(keptBody.essaConfig, "9A")

        const clearedFrom = bMsgs.length
        const cleared = await put(cidA, {
            essaSep: { sep: "4", dlv: "3", depGap: "" },
            essaSepOverrides: {},
        })
        assert.equal(cleared.status, 200)
        const clearedBody = await cleared.json()
        assert.deepEqual(clearedBody.essaSepOverrides, {})
        assert.deepEqual(clearedBody.meta.essaSepOverrides, {})
        await waitFor(() => bMsgs.slice(clearedFrom).some((m) => m.type === "meta"))
        const clearedFan = bMsgs.slice(clearedFrom).find((m) => m.type === "meta")
        assert.deepEqual(clearedFan.meta.essaSepOverrides, {})

        const again = await put(cidA, {
            essaSep: { sep: "4", dlv: "3", depGap: "" },
            essaSepOverrides: { sep: "3 nm", depGap: "" },
        })
        assert.equal(again.status, 200)

        const wsC = new WebSocket(wsUrl(333333))
        const cMsgs = collect(wsC)
        await waitFor(() => cMsgs.some((m) => m.type === "snapshot"))
        const snap = cMsgs.find((m) => m.type === "snapshot")
        assert.equal(snap.meta.essaSepOverrides.sep, "3 nm")
        assert.equal(snap.meta.essaSepOverrides.depGap, "")
        wsC.close()

        const beforeRefresh = await (await fetch(`${base}/meta`)).json()
        const aRe = aMsgs.length
        const bRe = bMsgs.length
        wsB.send("not json")
        wsB.send(JSON.stringify({ type: "meta", meta: {} }))
        wsB.send(JSON.stringify({ type: "reassertAssumed", updatedByCid: 1 }))
        await waitFor(() => aMsgs.slice(aRe).some((m) => m.type === "reassertAssumed"))
        const re = aMsgs.slice(aRe).filter((m) => m.type === "reassertAssumed")
        assert.equal(re.length, 1)
        assert.equal(re[0].updatedByCid, cidB)
        assert.equal(typeof re[0].updatedAt, "string")
        await new Promise((r) => setTimeout(r, 80))
        assert.equal(
            bMsgs.slice(bRe).some((m) => m.type === "reassertAssumed"),
            false,
        )
        const afterRefresh = await (await fetch(`${base}/meta`)).json()
        assert.equal(afterRefresh.updatedAt, beforeRefresh.updatedAt)
        assert.equal(afterRefresh.meta.essaSepOverrides.sep, "3 nm")
    } finally {
        wsA.close()
        wsB.close()
        await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
    }
})
