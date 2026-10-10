import test from "node:test"
import assert from "node:assert/strict"
import express from "express"
import { AmanRooms, Client, RelayError, LEASE_MS, STALE_MS } from "../src/aman/rooms"
import { createAmanRoomsRouter } from "../src/routes/aman-rooms"

const key = "sweatbox1/ESSA/essa-test-01/saaman"
const other = "sweatbox1/ESSA/essa-test-01/esaa-aman"
const a: Client = { id: "1396125:instance-a", callsign: "ESSA_APP", engine: { name: "saaman", version: "1.0.14", schema: "saaman-1" }, canSequence: true }
const b: Client = { ...a, id: "1234567:instance-b", callsign: "ESSA_E_APP" }
const observer: Client = { ...b, id: "observer:instance-c", canSequence: false }
const sequence = (callsign = "SAS123") => ({ data: { icao: "ESSA", timestamp: 1000 }, sequence: [{ callsign, state: 2 }] })
const publish = (r: AmanRooms, k: string, c: Client, s: any, extra: any = {}) => r.publish(k, c, { requestId: "pub-1", epoch: s.epoch, revision: s.revision, lease: s.lease, settingsRevision: s.settingsRevision, sequence: sequence(), checkpoint: { slots: [1, 2], aircraftHistory: ["SAS123"] }, ...extra })
const rejects = (status: number, action: () => unknown) => assert.throws(action, (e: any) => e instanceof RelayError && e.status === status)

test("same SweatBox traffic can have two independent AMAN rooms", () => {
    const r = new AmanRooms(() => 1000)
    const sa = r.poll(key, a, {}).data
    const esaa = { ...a, engine: { name: "esaa-aman", version: "1", schema: "esaa-1" } }
    const sb = r.poll(other, esaa, {}).data
    publish(r, key, a, sa)
    publish(r, other, esaa, sb, { sequence: sequence("DLH456") })
    assert.equal(r.sequence(key).sequence[0].callsign, "SAS123")
    assert.equal(r.sequence(other).sequence[0].callsign, "DLH456")
    r.settings(key, { ...r.poll(key, a, {}).data, settings: { rate: 25 } })
    assert.deepEqual(r.supervision(other).settings, {})
    const live = r.poll("live/ESSA/operational/saaman", a, {}).data
    assert.equal(live.revision, 0)
})
test("handover returns history and changes the lease; late old writes cannot win", () => {
    let now = 1000
    const r = new AmanRooms(() => now), first = r.poll(key, a, {}).data
    publish(r, key, a, first)
    now += LEASE_MS + 1
    const next = r.poll(key, b, {}).data
    assert.equal(next.role, "sequencer")
    assert.notEqual(next.lease, first.lease)
    assert.deepEqual(next.checkpoint.aircraftHistory, ["SAS123"])
    rejects(409, () => publish(r, key, a, first))
    publish(r, key, b, next)
})
test("different engines or incompatible schemas cannot share the sequencer", () => {
    const r = new AmanRooms()
    r.poll(key, a, {})
    rejects(409, () => r.poll(key, { ...b, engine: { ...b.engine, name: "esaa-aman" } }, {}))
    rejects(409, () => r.poll(key, { ...b, engine: { ...b.engine, schema: "saaman-2" } }, {}))
})
test("commands and publications are retry safe; results persist until acknowledged by cursor", () => {
    const r = new AmanRooms(), start = r.poll(key, a, {}).data
    const cmd = { requestId: "move-1", epoch: start.epoch, revision: 0, cmd: { op: "reorder", callsign: "SAS123" } }
    const accepted: any = r.command(key, b, cmd)
    assert.deepEqual(r.command(key, b, cmd), accepted)
    rejects(409, () => r.command(key, b, { ...cmd, cmd: { op: "remove" } }))
    const body = { results: [{ id: accepted.id, ok: true, message: "Applied" }], supervision: { explanation: "private" } }
    const published = publish(r, key, a, start, body)
    assert.deepEqual(publish(r, key, a, start, body), published)
    assert.equal(r.poll(key, a, {}).data.commands.length, 0)
    const reply = r.poll(key, b, {}).data
    assert.equal(reply.results.length, 1)
    assert.equal(reply.supervision, undefined)
    assert.equal(r.poll(key, b, {}).data.results.length, 1)
    assert.equal(r.poll(key, b, { resultsAfter: accepted.id }).data.results, undefined)
    assert.equal((r.supervision(key).supervision as any).explanation, "private")
})
test("bad command results reject the entire publication without losing pending commands", () => {
    const r = new AmanRooms(), s = r.poll(key, a, {}).data
    const cmd: any = r.command(key, b, { requestId: "move", epoch: s.epoch, revision: 0, cmd: { op: "reorder" } })
    rejects(400, () => publish(r, key, a, s, { results: [{ id: 999, ok: true, message: "invalid" }] }))
    assert.equal(r.poll(key, a, {}).data.revision, 0)
    assert.equal(r.poll(key, a, {}).data.commands[0].id, cmd.id)
})
test("expired commands report failure; stale sequences disappear", () => {
    let now = 1000
    const r = new AmanRooms(() => now), s = r.poll(key, a, {}).data
    publish(r, key, a, s)
    r.command(key, b, { requestId: "old", epoch: s.epoch, revision: 1, cmd: { op: "reorder" } })
    now += STALE_MS
    rejects(404, () => r.sequence(key))
    assert.equal(r.poll(key, observer, {}).data.sequence, null)
    now += 30_000
    const result = r.poll(key, b, {}).data.results[0]
    assert.equal(result.ok, false)
    assert.equal(result.message, "Command expired")
})
test("supervisor settings are canonical and invalidate calculations made with earlier settings", () => {
    const r = new AmanRooms(), s = r.poll(key, a, {}).data
    r.settings(key, { epoch: s.epoch, revision: 0, settings: { cruiseIas: 280 } })
    rejects(409, () => publish(r, key, a, s))
    rejects(409, () => publish(r, key, a, { ...s, revision: 1 }))
    const updated = r.poll(key, a, {}).data
    publish(r, key, a, updated)
    assert.deepEqual(r.supervision(key).settings, { cruiseIas: 280 })
    rejects(403, () => r.command(key, b, { requestId: "settings", epoch: s.epoch, revision: 2, cmd: { op: "settings" } }))
})
test("reset and backend restart change epoch and invalidate old cursors", () => {
    const r = new AmanRooms(), s = r.poll(key, a, {}).data
    publish(r, key, a, s)
    const reset = r.reset(key, { epoch: s.epoch, revision: 1 })
    assert.notEqual(reset.epoch, s.epoch)
    rejects(409, () => publish(r, key, a, s))
    const next = r.poll(key, b, s).data
    assert.equal(next.sequence, null)
    assert.equal(next.checkpoint, null)
    assert.notEqual(new AmanRooms().poll(key, a, {}).data.epoch, next.epoch)
})
test("read-only long polls do not acquire or renew a lease", () => {
    let now = 1000
    const r = new AmanRooms(() => now), s = r.poll(key, a, {}).data
    now += LEASE_MS - 1
    r.poll(key, a, s, false)
    now += 2
    assert.equal(r.poll(key, b, {}).data.role, "sequencer")
    r.leave(key, b)
    assert.notEqual(r.poll(key, a, s, false).data.role, "sequencer")
    assert.equal(r.poll(key, observer, {}).data.role, "observer")
})
test("queue is bounded and bad inputs do not create a publication", () => {
    const r = new AmanRooms(), s = r.poll(key, a, {}).data
    rejects(400, () => publish(r, key, a, s, { sequence: { data: { icao: "ESSB" }, sequence: [] } }))
    for (let i = 0; i < 500; i++) r.command(key, b, { requestId: `cmd-${i}`, epoch: s.epoch, revision: 0, cmd: { op: "reorder" } })
    rejects(429, () => r.command(key, b, { requestId: "overflow", epoch: s.epoch, revision: 0, cmd: { op: "reorder" } }))
    rejects(409, () => r.command(key, b, { requestId: "stale", epoch: s.epoch, revision: 100, cmd: { op: "reorder" } }))
})

test("switching the owner to observer releases ownership and cannot renew its lease", () => {
    const r = new AmanRooms()
    r.poll(key, a, {})
    const switched = r.poll(key, { ...a, canSequence: false }, {}).data
    assert.equal(switched.role, "observer")
    assert.equal(switched.lease, undefined)
    assert.equal(r.poll(key, b, {}).data.role, "sequencer")
})

test("actual HTTP routes authenticate writers and separate supervisor settings", async () => {
    const relay = createAmanRoomsRouter({ authenticate: async (req, res) => {
        const cid = Number(req.headers["x-test-cid"])
        if (!cid) { res.status(401).end(); return }
        return { cid }
    }, connected: async (cid, cs) => cid === 1396125 && cs === "ESSA_APP", supervisors: () => new Set([1396125]) })
    const app = express(); app.use(express.json({ limit: "2mb" })); app.use("/aman/rooms", relay.router)
    const server = app.listen(0, "127.0.0.1")
    await new Promise<void>(resolve => server.once("listening", resolve))
    const root = `http://127.0.0.1:${(server.address() as any).port}/aman/rooms/`
    const identity = { instanceId: "instance-a", callsign: a.callsign, engine: a.engine }
    const request = async (suffix: string, method: string, body?: any, cid?: number, room = key) => {
        const response = await fetch(root + room + suffix, { method, headers: { "content-type": "application/json", ...(cid ? { "x-test-cid": String(cid) } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
        const text = await response.text()
        return { status: response.status, body: text ? JSON.parse(text) : null }
    }
    try {
        assert.equal((await request("/poll", "POST", identity)).status, 401)
        const s = (await request("/poll", "POST", { ...identity, wait: false }, 1396125)).body
        assert.equal(s.role, "sequencer")
        assert.equal((await request("/settings", "PUT", { epoch: s.epoch, revision: 0, settings: { rate: 25 } }, 1234567)).status, 403)
        assert.equal((await request("/supervision", "GET", undefined, 1234567)).status, 403)
        assert.equal((await request("/reset", "POST", { epoch: s.epoch, revision: 0 }, 1234567)).status, 403)
        assert.equal((await request("/settings", "PUT", { epoch: s.epoch, revision: 0, settings: { rate: 25 } }, 1396125)).status, 200)
        assert.equal((await request("/leave", "POST", identity)).status, 401)
        assert.equal((await request("/poll", "POST", identity, 1234567, "live/ESSA/test/saaman")).status, 403)
        assert.equal((await request("/poll", "POST", identity, 1396125, "live/ESSA/test/saaman")).status, 200)
        assert.equal((await request("/poll", "POST", { ...identity, engine: { ...a.engine, schema: "wrong" } }, 1396125)).status, 409)
        assert.equal((await request("/poll", "POST", { ...identity, observer: "false" }, 1396125)).status, 400)
        assert.equal((await request("/command", "POST", { ...identity, observer: true }, 1396125)).status, 403)
        const updated = (await request("/poll", "POST", { ...identity, wait: false }, 1396125)).body
        const payload = { ...identity, ...updated, requestId: "publish", sequence: sequence(), checkpoint: { retained: true }, supervision: { private: true } }
        assert.equal((await request("", "PUT", payload, 1396125)).status, 200)
        const editor = { ...identity, instanceId: "instance-b", callsign: b.callsign }
        const e = (await request("/poll", "POST", { ...editor, wait: false }, 1234567)).body
        assert.equal(e.lease, undefined)
        assert.equal(e.supervision, undefined)
        assert.equal((await request("", "PUT", { ...payload, ...editor, requestId: "spoof" }, 1234567)).status, 409)
        assert.equal((await request("/supervision", "GET", undefined, 1396125)).body.supervision.private, true)
        assert.equal((await request("/MAESTRO_sequence_data_ESSA.json", "GET")).body.sequence[0].callsign, "SAS123")
        assert.equal((await request("/MAESTRO_sequence_data_ESSB.json", "GET")).status, 404)
        // Editor waits, then a publication wakes it with the new checkpoint.
        const waiting = request("/poll", "POST", { ...editor, epoch: e.epoch, revision: e.revision, role: e.role }, 1234567)
        await new Promise(resolve => setTimeout(resolve, 30))
        const current = (await request("/poll", "POST", { ...identity, wait: false }, 1396125)).body
        assert.equal((await request("", "PUT", { ...payload, ...current, requestId: "publish-2", checkpoint: { retained: 2 } }, 1396125)).status, 200)
        assert.equal((await waiting).body.checkpoint.retained, 2)
    } finally { relay.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})

test("production SweatBox key auth protects even leave; training key cannot grant supervision", async () => {
    const before = process.env.AMAN_SWEATBOX_KEY
    process.env.AMAN_SWEATBOX_KEY = "test-only-key"
    const relay = createAmanRoomsRouter()
    const app = express(); app.use(express.json()); app.use("/aman/rooms", relay.router)
    const server = app.listen(0, "127.0.0.1")
    await new Promise<void>(resolve => server.once("listening", resolve))
    const url = `http://127.0.0.1:${(server.address() as any).port}/aman/rooms/${key}`
    const body = JSON.stringify({ instanceId: "instance-a", callsign: a.callsign, engine: a.engine, wait: false })
    try {
        const send = (path: string, token?: string) => fetch(url + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-aman-key": token } : {}) }, body })
        assert.equal((await send("/poll")).status, 403)
        assert.equal((await send("/leave")).status, 403)
        assert.equal((await send("/poll", "test-only-key")).status, 200)
        assert.equal((await fetch(url + "/supervision", { headers: { "x-aman-key": "test-only-key" } })).status, 403)
    } finally {
        if (before === undefined) delete process.env.AMAN_SWEATBOX_KEY; else process.env.AMAN_SWEATBOX_KEY = before
        relay.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    }
})
