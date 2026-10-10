// Shared AMAN sequence for the ESAA AMAN EuroScope plugin.
//
// Every controller using the plugin is equal: all can change the sequence. Exactly one connected EuroScope
// (the "sequencer", chosen automatically) computes the sequence from its radar picture; changes made by the
// others are sent here as commands, applied by the sequencer and published back to everyone within about a
// second (long polling). If the sequencer disappears, the next client takes over from the latest sequence.
//
// Rooms are separated per network so that training never touches the live sequence:
//   live       VATSIM network: writers must be connected as ATC (checked against the VATSIM data feed)
//   sweatbox1  SWEATBOX server   } no public data feed exists for the sweatbox servers: open, or protected by
//   sweatbox2  SWEATBOX-2 server } AMAN_SWEATBOX_KEY when set
//
//   POST /aman/:net/:icao/poll      { callsign, role, version, cmdAfter }  long poll (<= 20 s)
//        -> { role, sequencer, version, sequence?, commands?, results?, users }
//   PUT  /aman/:net/:icao           { callsign, sequence, results?, cmdAck? }   sequencer only (409 otherwise)
//   POST /aman/:net/:icao/command   { callsign, cmd }                           -> { id }
//   POST /aman/:net/:icao/leave     { callsign }
//   GET  /aman/:net/:icao           latest sequence (MAESTRO format)
//   GET  /aman/MAESTRO_sequence_data_<ICAO>.json   live sequence, for TopSky's AMAN_URL
//   GET  /aman                      status of all rooms (for the VatIRIS frontend)

import { Router, Request, Response } from "express"
import axios from "axios"

const aman = Router()

const POLL_TIMEOUT_MS = 20_000
const LEASE_MS = 8_000 // sequencer considered gone after this long without a request
const CLIENT_TIMEOUT_MS = 60_000
const COMMAND_TTL_MS = 60_000
const MAX_AGE_MS = 10 * 60_000 // sequence served to TopSky/readers while younger than this
const NETWORKS = ["live", "sweatbox1", "sweatbox2"] as const
type Network = (typeof NETWORKS)[number]

interface Command {
    id: number
    from: string
    cmd: any
    at: number
}

interface Result {
    id: number
    ok: boolean
    message: string
}

interface Waiter {
    callsign: string
    role: string
    version: number
    cmdAfter: number
    res: Response
    timer: NodeJS.Timeout
}

interface Room {
    net: Network
    icao: string
    version: number
    sequence: any | null
    sequenceAt: number
    sequencer: string | null
    sequencerSeen: number
    commands: Command[]
    nextCommandId: number
    results: Map<string, Result[]>
    clients: Map<string, number>
    waiters: Set<Waiter>
}

const rooms = new Map<string, Room>()

function room(net: Network, icao: string): Room {
    const key = `${net}/${icao}`
    let r = rooms.get(key)
    if (!r) {
        r = {
            net,
            icao,
            version: 0,
            sequence: null,
            sequenceAt: 0,
            sequencer: null,
            sequencerSeen: 0,
            commands: [],
            nextCommandId: 1,
            results: new Map(),
            clients: new Map(),
            waiters: new Set(),
        }
        rooms.set(key, r)
    }
    return r
}

function parseRoom(req: Request, res: Response): Room | undefined {
    const net = String(req.params.net || "").toLowerCase() as Network
    const icao = String(req.params.icao || "").toUpperCase()
    if (!NETWORKS.includes(net) || !/^[A-Z]{4}$/.test(icao)) {
        res.status(404).send("Unknown network or airport")
        return undefined
    }
    return room(net, icao)
}

function callsignOf(req: Request): string {
    return String(req.body?.callsign || "")
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "")
        .substring(0, 20)
}

// ---------------------------------------------------------------- who may write

let atcCallsigns = new Set<string>()
let atcFetchedAt = 0
let atcFetching: Promise<void> | null = null

async function refreshAtc() {
    if (Date.now() - atcFetchedAt < 15_000) return
    if (!atcFetching) {
        atcFetching = axios
            .get("https://data.vatsim.net/v3/vatsim-data.json", { timeout: 8000 })
            .then((r) => {
                const set = new Set<string>()
                for (const c of r.data?.controllers || []) if (c.facility > 0) set.add(String(c.callsign).toUpperCase())
                atcCallsigns = set
                atcFetchedAt = Date.now()
            })
            .catch((e) => console.warn("AMAN: VATSIM data feed unavailable:", e.message))
            .finally(() => (atcFetching = null))
    }
    await atcFetching
}

async function authorize(req: Request, res: Response, r: Room, callsign: string): Promise<boolean> {
    if (!callsign) {
        res.status(400).send("Missing callsign")
        return false
    }
    if (r.net === "live") {
        if (process.env.AMAN_REQUIRE_ATC === "0") return true
        await refreshAtc()
        // Without any data feed (VATSIM outage) nobody could work: then it is not checked.
        if (atcFetchedAt === 0) return true
        if (!atcCallsigns.has(callsign)) {
            res.status(403).send(`${callsign} is not connected as ATC on VATSIM (the network data is updated every 15 s)`)
            return false
        }
        return true
    }
    const key = process.env.AMAN_SWEATBOX_KEY
    if (key && req.body?.key !== key) {
        res.status(403).send("Wrong sweatbox key")
        return false
    }
    return true
}

// ---------------------------------------------------------------- sequencer lease

function sequencerAlive(r: Room): boolean {
    if (!r.sequencer) return false
    for (const w of r.waiters) if (w.callsign === r.sequencer) return true
    return Date.now() - r.sequencerSeen < LEASE_MS
}

// Gives the sequencer role to `callsign` when it is free. Returns the callsign's role.
function claim(r: Room, callsign: string): "sequencer" | "editor" {
    if (!sequencerAlive(r) && r.sequencer !== callsign) {
        if (r.sequencer) console.log(`AMAN ${r.net}/${r.icao}: sequencer ${r.sequencer} gone, ${callsign} takes over`)
        else console.log(`AMAN ${r.net}/${r.icao}: ${callsign} is the sequencer`)
        r.sequencer = callsign
    }
    if (r.sequencer === callsign) {
        r.sequencerSeen = Date.now()
        return "sequencer"
    }
    return "editor"
}

function users(r: Room): string[] {
    const now = Date.now()
    for (const [cs, seen] of r.clients) if (now - seen > CLIENT_TIMEOUT_MS) r.clients.delete(cs)
    for (const w of r.waiters) r.clients.set(w.callsign, now)
    return [...r.clients.keys()].sort()
}

// The answer for a waiting client, or undefined if nothing new for it yet.
function answer(r: Room, w: Omit<Waiter, "res" | "timer">, force: boolean): any | undefined {
    const role = claim(r, w.callsign)
    const roleChanged = role !== w.role
    const out: any = { role, sequencer: r.sequencer, version: r.version, users: users(r) }
    let news = force || roleChanged
    if (r.version > w.version || (roleChanged && role === "sequencer")) {
        // new sequence (or the seed for a new sequencer)
        if (r.sequence && (role === "editor" || roleChanged)) {
            out.sequence = r.sequence
            news = true
        }
    }
    if (role === "sequencer") {
        const now = Date.now()
        r.commands = r.commands.filter((c) => now - c.at < COMMAND_TTL_MS)
        const cmds = r.commands.filter((c) => c.id > w.cmdAfter)
        if (cmds.length) {
            out.commands = cmds.map((c) => ({ id: c.id, from: c.from, cmd: c.cmd }))
            news = true
        }
    }
    const results = r.results.get(w.callsign)
    if (results?.length) {
        out.results = results
        r.results.delete(w.callsign)
        news = true
    }
    return news ? out : undefined
}

function wake(r: Room) {
    for (const w of [...r.waiters]) {
        if (w.res.writableEnded || w.res.destroyed) {
            // connection already gone: must not claim the sequencer role
            clearTimeout(w.timer)
            r.waiters.delete(w)
            continue
        }
        const out = answer(r, w, false)
        if (out) {
            clearTimeout(w.timer)
            r.waiters.delete(w)
            w.res.send(out)
        }
    }
}

// Release the role of a vanished sequencer even while everybody else is waiting.
setInterval(() => {
    for (const r of rooms.values()) if (r.sequencer && !sequencerAlive(r)) wake(r)
}, 2000)

// ---------------------------------------------------------------- routes

aman.get("/", (req: Request, res: Response) => {
    const status: { [key: string]: any } = {}
    for (const [key, r] of rooms) {
        status[key] = {
            sequencer: sequencerAlive(r) ? r.sequencer : null,
            users: users(r),
            version: r.version,
            updated: r.sequenceAt ? new Date(r.sequenceAt).toISOString() : null,
            flights: Array.isArray(r.sequence?.sequence) ? r.sequence.sequence.length : 0,
        }
    }
    res.send(status)
})

function sendSequence(res: Response, r: Room | undefined) {
    if (!r || !r.sequence || Date.now() - r.sequenceAt > MAX_AGE_MS) {
        res.status(404).send("Not found")
        return
    }
    res.set("Cache-Control", "no-cache")
    res.send(r.sequence)
}

// TopSky AMAN_URL: <base>/MAESTRO_sequence_data_ESSA.json (live network)
aman.get("/:file", (req: Request, res: Response) => {
    const m = /^(?:MAESTRO_sequence_data_)?([A-Z]{4})(?:\.json)?$/i.exec(req.params.file)
    sendSequence(res, m ? rooms.get(`live/${m[1].toUpperCase()}`) : undefined)
})

aman.get("/:net/:icao", (req: Request, res: Response) => {
    const icao = String(req.params.icao).replace(/^MAESTRO_sequence_data_/i, "").replace(/\.json$/i, "")
    sendSequence(res, rooms.get(`${String(req.params.net).toLowerCase()}/${icao.toUpperCase()}`))
})

aman.post("/:net/:icao/poll", async (req: Request, res: Response) => {
    const r = parseRoom(req, res)
    if (!r) return
    const callsign = callsignOf(req)
    if (!(await authorize(req, res, r, callsign))) return
    r.clients.set(callsign, Date.now())
    const w = {
        callsign,
        role: String(req.body?.role || ""),
        version: Number(req.body?.version) || 0,
        cmdAfter: Number(req.body?.cmdAfter) || 0,
    }
    const out = answer(r, w, !w.role) // first poll of a client: answer at once
    if (out) {
        res.send(out)
        return
    }
    const waiter: Waiter = {
        ...w,
        res,
        timer: setTimeout(() => {
            r.waiters.delete(waiter)
            res.send(answer(r, waiter, true))
        }, POLL_TIMEOUT_MS),
    }
    r.waiters.add(waiter)
    // The client gave up (plugin stopped, connection lost): forget the waiting request. (The response's close
    // event: the request's fires as soon as its body has been read.)
    res.on("close", () => {
        if (r.waiters.delete(waiter)) clearTimeout(waiter.timer)
    })
})

aman.put("/:net/:icao", async (req: Request, res: Response) => {
    const r = parseRoom(req, res)
    if (!r) return
    const callsign = callsignOf(req)
    if (!(await authorize(req, res, r, callsign))) return
    if (claim(r, callsign) !== "sequencer") {
        res.status(409).send(`The sequence is computed by ${r.sequencer}`)
        return
    }
    const seq = req.body?.sequence
    if (!seq || typeof seq !== "object" || !seq.data || !Array.isArray(seq.sequence)) {
        res.status(400).send("Invalid sequence data")
        return
    }
    if (String(seq.data.icao || "").toUpperCase() !== r.icao) {
        res.status(400).send("Airport mismatch")
        return
    }
    r.sequence = seq
    r.sequenceAt = Date.now()
    r.version++
    const ack = Number(req.body?.cmdAck) || 0
    if (ack) r.commands = r.commands.filter((c) => c.id > ack)
    for (const result of req.body?.results || []) {
        const from = String(result.from || "")
        if (!from) continue
        const list = r.results.get(from) || []
        list.push({ id: Number(result.id) || 0, ok: !!result.ok, message: String(result.message || "") })
        r.results.set(from, list)
    }
    wake(r)
    res.send({ version: r.version })
})

aman.post("/:net/:icao/command", async (req: Request, res: Response) => {
    const r = parseRoom(req, res)
    if (!r) return
    const callsign = callsignOf(req)
    if (!(await authorize(req, res, r, callsign))) return
    const cmd = req.body?.cmd
    if (!cmd || typeof cmd !== "object" || typeof cmd.op !== "string") {
        res.status(400).send("Invalid command")
        return
    }
    if (!sequencerAlive(r)) {
        res.status(503).send("No AMAN is computing the sequence at the moment")
        return
    }
    const id = r.nextCommandId++
    r.commands.push({ id, from: callsign, cmd, at: Date.now() })
    wake(r)
    res.send({ id })
})

aman.post("/:net/:icao/leave", async (req: Request, res: Response) => {
    const r = parseRoom(req, res)
    if (!r) return
    const callsign = callsignOf(req)
    r.clients.delete(callsign)
    // Answer its waiting request at once: the plugin is stopping and waits for it.
    for (const w of [...r.waiters])
        if (w.callsign === callsign) {
            clearTimeout(w.timer)
            r.waiters.delete(w)
            if (!w.res.writableEnded) w.res.send({ role: "", left: true })
        }
    if (r.sequencer === callsign) {
        console.log(`AMAN ${r.net}/${r.icao}: sequencer ${callsign} left`)
        r.sequencer = null
        wake(r)
    }
    res.send("ok")
})

export default aman
