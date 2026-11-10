import test from "node:test"
import assert from "node:assert/strict"
import express from "express"
import { IncomingMessage, ServerResponse } from "node:http"
import { Duplex } from "node:stream"
import type { Socket } from "node:net"
import { topSkySequence } from "../src/aman/topsky-sequence"

const publication = (timestamp = 100_000) => {
    const flights = [
        { callsign: "UPSTREAM", state: 1, passedFeeder: false },
        { callsign: "HOLD123", state: 2, passedFeeder: false, topskyHoldingPoint: "NILUG" },
        { callsign: "PASSED", state: 2, passedFeeder: true },
        { callsign: "BYPASS", state: 2, passedFeeder: false, line0Suppressed: true },
        { callsign: "LANDED", state: 4, passedFeeder: false },
        { callsign: "FROZEN", state: 3, passedFeeder: false },
    ]
    return {
        data: { icao: "ESSA", source: "ESSA_FMP", timestamp: Math.round(timestamp / 1000) },
        wind: { sfc_deg: 270, sfc_kts: 8 }, airports: [{ icao: "ESSA" }], runways: [{ id: "26", active: true }], feeders: [{ name: "NILUG" }],
        sequence: flights.map(f => ({ callsign: f.callsign, state: f.state, ff: "NILUG", sta_ff: 200, ttlttg_ff: f.callsign === "HOLD123" ? 300 : 0 })),
        saamanRelay: { protocol: "saaman-legacy-1", checkpoint: { schema: "saaman-1.1.9", snapshot: { timestamp, flights } }, receipts: { private: { message: "internal receipt" } }, lease: "internal lease" },
        privateExtension: { secret: "not a MAESTRO field" },
    }
}

test("TopSky keeps real upstream L00, HOLD and Frozen guidance, and removes obsolete feeder rows", () => {
    const source = publication(), original = structuredClone(source), view = topSkySequence(source)!
    assert.deepEqual(view.sequence.map((f: any) => f.callsign), ["UPSTREAM", "HOLD123", "FROZEN"])
    assert.equal(view.sequence[0].ttlttg_ff, 0, "zero is a valid upstream instruction")
    assert.equal(view.sequence[1].ttlttg_ff, 300)
    assert.deepEqual(source, original, "public projection must not alter shared recovery data")
})

test("public projection contains only MAESTRO fields and no recovery/checkpoint/receipt data", () => {
    const source = publication(), view = topSkySequence(source)!
    assert.deepEqual(Object.keys(view), ["data", "wind", "airports", "runways", "feeders", "sequence"])
    assert.deepEqual(view.data, source.data); assert.deepEqual(view.runways, source.runways)
    assert.ok(!JSON.stringify(view).includes("internal")); assert.ok(!JSON.stringify(view).includes("privateExtension"))
})

test("legacy MAESTRO publishers retain their rows and standard airport/runway fields", () => {
    const source: any = publication(); delete source.saamanRelay; source.data.icao = "ESSB"
    const view = topSkySequence(source)!
    assert.deepEqual(view.sequence, source.sequence)
    assert.equal(view.data.icao, "ESSB"); assert.deepEqual(view.feeders, source.feeders)
})

test("malformed or mismatched SAAMAN checkpoints fail closed instead of exposing the full sequence", () => {
    const changes = [
        (s: any) => { delete s.saamanRelay.checkpoint },
        (s: any) => { s.saamanRelay.protocol = "unknown" },
        (s: any) => { s.saamanRelay.checkpoint.schema = "unknown" },
        (s: any) => { s.saamanRelay.checkpoint.snapshot.timestamp += 2000 },
        (s: any) => { s.saamanRelay.checkpoint.snapshot.flights[0].passedFeeder = "false" },
        (s: any) => { s.saamanRelay.checkpoint.snapshot.flights[0].state = "1" },
        (s: any) => { s.saamanRelay.checkpoint.snapshot.flights.push(s.saamanRelay.checkpoint.snapshot.flights[0]) },
        (s: any) => { s.sequence[0].callsign = "UNKNOWN" },
    ]
    for (const change of changes) { const s = publication(); change(s); assert.equal(topSkySequence(s), undefined) }
})

// Exercise actual Express parsing/routing/HTTP serialization with no listening
// socket. This is also usable on build hosts where loopback binding is blocked.
test("public filename routes are filtered; plain room reads and writes preserve the opaque shared sequence", async t => {
    let now = 100_000
    const oldNow = Date.now, oldInterval = global.setInterval, oldAtc = process.env.AMAN_REQUIRE_ATC
    const timers: ReturnType<typeof setInterval>[] = []
    Date.now = () => now; process.env.AMAN_REQUIRE_ATC = "0"
    global.setInterval = ((...args: any[]) => { const timer = (oldInterval as any)(...args); timer.unref(); timers.push(timer); return timer }) as typeof setInterval
    try {
        const { default: router } = await import("../src/routes/aman")
        const app = express(); app.use(express.json()); app.use("/aman", router)
        function request(method: string, path: string, body?: any): Promise<{ status: number; headers: string; body: any }> {
            return new Promise((resolve, reject) => {
                const chunks: Buffer[] = [], payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
                const socket = new Duplex({ read() {}, write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback() } })
                const req = new IncomingMessage(socket as unknown as Socket); req.method = method; req.url = path; req.httpVersion = "1.1"; req.httpVersionMajor = 1; req.httpVersionMinor = 1
                req.headers = { "content-type": "application/json", host: "in-process.test", ...(payload ? { "content-length": String(payload.length) } : {}) }
                req.rawHeaders = Object.entries(req.headers).flatMap(([key, value]) => [key, String(value)])
                const res = new ServerResponse(req); res.assignSocket(socket as unknown as Socket)
                const timeout = setTimeout(() => { socket.destroy(); reject(new Error("In-process HTTP request timed out")) }, 5000)
                const fail = (error: any) => { clearTimeout(timeout); socket.destroy(); reject(error) }
                socket.on("error", fail); res.on("error", fail)
                res.on("finish", () => {
                    clearTimeout(timeout)
                    try {
                        const wire = Buffer.concat(chunks), divider = wire.indexOf("\r\n\r\n"), headers = wire.subarray(0, divider).toString("latin1")
                        assert.ok(divider > 0); assert.ok(!/transfer-encoding:\s*chunked/i.test(headers))
                        const text = wire.subarray(divider + 4).toString("utf8"); let data: any
                        try { data = JSON.parse(text) } catch { data = text }
                        resolve({ status: Number(/^HTTP\/1\.[01] (\d+)/.exec(headers)![1]), headers, body: data })
                    } catch (error) { reject(error) } finally { socket.destroy() }
                })
                ;(app as any).handle(req, res, (error: any) => { if (error) fail(error); else { res.statusCode = 404; res.end("Not Found") } })
                if (payload) req.push(payload); req.push(null); req.complete = true
            })
        }
        const publish = (sequence: any, icao = "ESSA") => request("PUT", `/aman/live/${icao}`, { callsign: "ESSA_FMP", sequence })
        await t.test("all TopSky filename aliases use the same filtered replacement, while editor GET stays complete", async () => {
            const full = publication(now); assert.equal((await publish(full)).status, 200)
            const expected = topSkySequence(full); assert.ok(expected)
            for (const path of ["/aman/MAESTRO_sequence_data_ESSA.json", "/aman/ESSA", "/aman/live/MAESTRO_sequence_data_ESSA.json", "/aman/live/ESSA.json"]) {
                const r = await request("GET", path)
                assert.equal(r.status, 200, path); assert.match(r.headers, /cache-control: no-store/i)
                assert.deepEqual(r.body, expected, path)
                assert.equal(r.body.saamanRelay, undefined)
            }
            const editor = await request("GET", "/aman/live/ESSA")
            assert.equal(editor.status, 200); assert.deepEqual(editor.body, full)
        })
        await t.test("a new complete public replacement clears previously visible guidance when its flight passes the feeder", async () => {
            const full = publication(now); full.saamanRelay.checkpoint.snapshot.flights[0].passedFeeder = true
            assert.equal((await publish(full)).status, 200)
            const r = await request("GET", "/aman/MAESTRO_sequence_data_ESSA.json")
            assert.equal(r.status, 200); assert.ok(!r.body.sequence.some((f: any) => f.callsign === "UPSTREAM"))
            assert.ok((await request("GET", "/aman/live/ESSA")).body.sequence.some((f: any) => f.callsign === "UPSTREAM"))
        })
        await t.test("stale public and full reads are 404 with no-store; no abandoned guidance is served as a fresh 200", async () => {
            now += 30_001
            for (const path of ["/aman/MAESTRO_sequence_data_ESSA.json", "/aman/live/ESSA.json", "/aman/live/ESSA"]) {
                const r = await request("GET", path); assert.equal(r.status, 404); assert.match(r.headers, /cache-control: no-store/i)
            }
        })
        await t.test("a malformed recognized publication is withheld from TopSky while remaining available to its own recovery client", async () => {
            const full: any = publication(now); delete full.saamanRelay.checkpoint
            assert.equal((await publish(full)).status, 200)
            const r = await request("GET", "/aman/MAESTRO_sequence_data_ESSA.json")
            assert.equal(r.status, 404); assert.match(r.headers, /cache-control: no-store/i)
            assert.deepEqual((await request("GET", "/aman/live/ESSA")).body, full)
        })
        await t.test("other airports and legacy publishers keep their standard data and rows", async () => {
            const full: any = publication(now); delete full.saamanRelay; full.data.icao = "ESSB"
            assert.equal((await publish(full, "ESSB")).status, 200)
            const r = await request("GET", "/aman/MAESTRO_sequence_data_ESSB.json")
            assert.equal(r.status, 200); assert.equal(r.body.data.icao, "ESSB"); assert.deepEqual(r.body.sequence, full.sequence)
        })
    } finally {
        Date.now = oldNow; global.setInterval = oldInterval; for (const timer of timers) clearInterval(timer)
        if (oldAtc === undefined) delete process.env.AMAN_REQUIRE_ATC; else process.env.AMAN_REQUIRE_ATC = oldAtc
    }
})
