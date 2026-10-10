import { Router, Request, Response } from "express"
import { timingSafeEqual } from "crypto"
import axios from "axios"
import auth from "../auth"
import { AmanRooms, Client, RelayError } from "../aman/rooms"

interface Principal { cid?: number; training?: boolean }
interface Dependencies {
    rooms?: AmanRooms
    authenticate?: (req: Request, res: Response) => Promise<Principal | undefined>
    connected?: (cid: number, callsign: string) => Promise<boolean>
    supervisors?: () => Set<number>
}
const supervisors = () => new Set((process.env.AMAN_SUPERVISOR_CIDS ?? "1396125").split(",").map(Number).filter(x => x > 0))
let controllers: { cid: number; callsign: string }[] = []
let fetched = 0
let fetching: Promise<void> | undefined
async function connected(cid: number, callsign: string) {
    if (Date.now() - fetched >= 15_000) {
        fetching ||= axios.get("https://data.vatsim.net/v3/vatsim-data.json", { timeout: 8000 }).then(result => {
            controllers = (result.data.controllers || []).filter((c: any) => c.facility > 0)
                .map((c: any) => ({ cid: Number(c.cid), callsign: String(c.callsign).toUpperCase() }))
            fetched = Date.now()
        }).finally(() => { fetching = undefined })
        try { await fetching } catch { throw new RelayError(503, "VATSIM controller feed unavailable") }
    }
    return controllers.some(c => c.cid === cid && c.callsign === callsign)
}
async function authenticate(req: Request, res: Response): Promise<Principal | undefined> {
    if (req.headers.authorization?.startsWith("Bearer ")) {
        const user = await auth.requireUser(req, res)
        if (!user) return undefined
        const cid = Number(user.cid)
        if (!Number.isSafeInteger(cid) || cid <= 0) throw new RelayError(401, "Invalid controller identity")
        return { cid }
    }
    if (req.params.net === "live") throw new RelayError(401, "VATSIM sign-in required")
    const expected = process.env.AMAN_SWEATBOX_KEY
    const supplied = req.headers["x-aman-key"]
    if (expected) {
        if (typeof supplied !== "string" || Buffer.byteLength(supplied) !== Buffer.byteLength(expected)
            || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw new RelayError(403, "Wrong SweatBox key")
        return { training: true }
    }
    if (process.env.AMAN_ALLOW_OPEN_SWEATBOX === "1") return { training: true }
    throw new RelayError(401, "Sign in or configure a SweatBox key")
}
const slug = (x: unknown) => typeof x === "string" && /^[a-z0-9][a-z0-9_-]{0,47}$/.test(x)
function key(req: Request) {
    const { net, icao, session, channel } = req.params
    if (!["live", "sweatbox1", "sweatbox2"].includes(net) || !/^[A-Z]{4}$/.test(icao) || !slug(session) || !slug(channel))
        throw new RelayError(404, "Unknown network, airport, session or channel")
    return `${net}/${icao}/${session}/${channel}`
}
function client(req: Request, principal: Principal): Client {
    const { instanceId, callsign, engine, observer } = req.body || {}
    if (typeof instanceId !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(instanceId)
        || typeof callsign !== "string" || !/^[A-Z0-9_-]{1,20}$/.test(callsign)
        || !engine || !slug(engine.name) || typeof engine.version !== "string" || !/^[A-Za-z0-9._-]{1,40}$/.test(engine.version)
        || typeof engine.schema !== "string" || !/^[A-Za-z0-9._-]{1,40}$/.test(engine.schema)
        || (observer !== undefined && typeof observer !== "boolean")) throw new RelayError(400, "Invalid plugin identity or engine metadata")
    return { id: `${principal.cid ?? "training"}:${instanceId}`, callsign,
        engine: { name: engine.name, version: engine.version, schema: engine.schema }, canSequence: observer !== true }
}

export function createAmanRoomsRouter(deps: Dependencies = {}) {
    const router = Router(), rooms = deps.rooms || new AmanRooms()
    const authenticateClient = deps.authenticate || authenticate
    const atcConnected = deps.connected || connected
    const permitted = deps.supervisors || supervisors
    const timer = setInterval(() => rooms.sweep(), 2000)
    timer.unref()
    const base = "/:net/:icao/:session/:channel"
    function route(method: "get" | "post" | "put", path: string, action: (req: Request, res: Response, room: string, principal: Principal) => Promise<void> | void) {
        router[method](base + path, async (req, res) => {
            try {
                const room = key(req)
                const principal = await authenticateClient(req, res)
                if (!principal || res.headersSent) return
                res.set("Cache-Control", "no-store")
                await action(req, res, room, principal)
            } catch (e: any) {
                if (!res.headersSent) res.status(e instanceof RelayError ? e.status : 503).json({ error: e instanceof RelayError ? e.message : "AMAN service unavailable" })
            }
        })
    }
    async function identity(req: Request, principal: Principal, writable: boolean) {
        const c = client(req, principal)
        if (writable && !c.canSequence) throw new RelayError(403, "Observer cannot edit")
        if (req.params.net === "live" && c.canSequence && process.env.AMAN_REQUIRE_ATC !== "0"
            && (!principal.cid || !await atcConnected(principal.cid, c.callsign))) throw new RelayError(403, "CID and callsign are not connected as ATC")
        return c
    }
    function supervisor(p: Principal) {
        if (!p.cid || !permitted().has(p.cid)) throw new RelayError(403, "Supervisor access required")
    }
    route("post", "/poll", async (req, res, room, p) => {
        const c = await identity(req, p, false)
        const input = req.body
        if ((input.revision !== undefined && (!Number.isSafeInteger(input.revision) || input.revision < 0))
            || (input.resultsAfter !== undefined && (!Number.isSafeInteger(input.resultsAfter) || input.resultsAfter < 0))
            || (input.epoch !== undefined && typeof input.epoch !== "string")) throw new RelayError(400, "Invalid poll cursor")
        const first = rooms.poll(room, c, input)
        if (first.changed || input.wait === false) { res.json(first.data); return }
        // Subscribe without re-electing disconnected or leaving clients. Lease needs a separate heartbeat.
        let done = false
        let unsubscribe = () => {}
        let timeout: NodeJS.Timeout
        const finish = (force: boolean) => {
            if (done || res.destroyed || res.writableEnded) return
            try {
                const next = rooms.poll(room, c, input, false)
                // Reading a waiting response must not renew the sequencer heartbeat.
                if (!force && !next.changed) return
                done = true; clearTimeout(timeout); unsubscribe(); res.json(next.data)
            } catch (e) { done = true; clearTimeout(timeout); unsubscribe(); res.status(409).json({ error: "Room changed; rejoin" }) }
        }
        timeout = setTimeout(() => finish(true), 20_000)
        unsubscribe = rooms.subscribe(room, () => finish(false))
        res.on("close", () => { done = true; clearTimeout(timeout); unsubscribe() })
    })
    route("put", "", async (req, res, room, p) => { res.json(rooms.publish(room, await identity(req, p, true), req.body)) })
    route("post", "/command", async (req, res, room, p) => { res.json(rooms.command(room, await identity(req, p, true), req.body)) })
    route("post", "/leave", async (req, res, room, p) => { res.json(rooms.leave(room, await identity(req, p, false))) })
    route("get", "/supervision", (req, res, room, p) => { supervisor(p); res.json(rooms.supervision(room)) })
    route("put", "/settings", (req, res, room, p) => { supervisor(p); res.json(rooms.settings(room, req.body)) })
    route("post", "/reset", (req, res, room, p) => { supervisor(p); res.json(rooms.reset(room, req.body)) })
    // Explicitly scoped read-only MAESTRO feeds; never choose between competing rooms automatically.
    router.get(base + "/MAESTRO_sequence_data_:airport.json", (req, res) => {
        try {
            const room = key(req)
            if (req.params.airport !== req.params.icao) throw new RelayError(404, "Airport mismatch")
            res.set("Cache-Control", "no-store").json(rooms.sequence(room))
        } catch (e: any) { res.status(e instanceof RelayError ? e.status : 503).json({ error: e.message }) }
    })
    return { router, close: () => clearInterval(timer) }
}

export default createAmanRoomsRouter().router
