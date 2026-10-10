import { createHash, randomUUID } from "crypto"

export class RelayError extends Error {
    constructor(public status: number, message: string) { super(message) }
}
export interface Engine { name: string; version: string; schema: string }
export interface Client { id: string; callsign: string; engine: Engine; canSequence: boolean }
interface Command { id: number; from: string; cmd: Record<string, unknown>; at: number }
interface Result { id: number; ok: boolean; message: string; at: number }
interface Room {
    epoch: string; revision: number; settingsRevision: number; settings: unknown
    engine: Engine | null; sequence: any; checkpoint: unknown; supervision: unknown; updated: number
    owner: Client | null; lease: string; seen: number; touched: number
    clients: Map<string, { client: Client; seen: number }>; commands: Command[]; nextId: number
    results: Map<string, Result[]>; retries: Map<string, { fingerprint: string; response: unknown; at: number }>
    listeners: Set<() => void>
}
export const LEASE_MS = 8_000
export const STALE_MS = 30_000
const COMMAND_MS = 60_000
const RETRY_MS = 120_000
const IDLE_MS = 30 * 60_000
const LIMIT = 500
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
function bounded(value: unknown, bytes: number) {
    if (value === undefined || Buffer.byteLength(JSON.stringify(value)) > bytes) throw new RelayError(413, "AMAN payload exceeds limit")
}
const compatible = (a: Engine, b: Engine) => a.name === b.name && a.schema === b.schema

// No aircraft calculations here: each compatible plugin room owns its opaque recovery state.
export class AmanRooms {
    private rooms = new Map<string, Room>()
    constructor(private now = Date.now) {}
    private get(key: string): Room {
        let r = this.rooms.get(key)
        if (!r) {
            this.sweep()
            if (this.rooms.size >= 200) throw new RelayError(503, "AMAN room limit reached")
            const now = this.now()
            r = { epoch: randomUUID(), revision: 0, settingsRevision: 0, settings: {}, engine: null,
                sequence: null, checkpoint: null, supervision: null, updated: 0, owner: null, lease: "", seen: 0,
                touched: now, clients: new Map(), commands: [], nextId: 1, results: new Map(), retries: new Map(), listeners: new Set() }
            this.rooms.set(key, r)
        }
        return r
    }
    private alive(r: Room) { return !!r.owner && this.now() - r.seen < LEASE_MS }
    private notify(r: Room) { for (const listener of [...r.listeners]) listener() }
    private check(r: Room, epoch: unknown, revision: unknown) {
        if (epoch !== r.epoch || revision !== r.revision) throw new RelayError(409, "Room changed; poll before retrying")
    }
    private result(r: Room, from: string, result: Result) {
        const list = r.results.get(from) || []
        list.push(result)
        r.results.set(from, list.slice(-LIMIT))
    }
    private expire(r: Room) {
        const now = this.now()
        for (const c of r.commands) if (now - c.at >= COMMAND_MS)
            this.result(r, c.from, { id: c.id, ok: false, message: "Command expired", at: now })
        r.commands = r.commands.filter(c => now - c.at < COMMAND_MS)
        for (const [id, list] of r.results) {
            const remaining = list.filter(x => now - x.at < RETRY_MS)
            if (remaining.length) r.results.set(id, remaining); else r.results.delete(id)
        }
        for (const [id, value] of r.retries) if (now - value.at >= RETRY_MS) r.retries.delete(id)
        for (const [id, value] of r.clients) if (now - value.seen >= COMMAND_MS) r.clients.delete(id)
    }
    poll(key: string, client: Client, input: { epoch?: string; revision?: number; role?: string; resultsAfter?: number }, touch = true) {
        const r = this.get(key), now = this.now()
        if (r.engine && !compatible(r.engine, client.engine)) throw new RelayError(409, "Different engine or state schema; use another channel")
        this.expire(r)
        if (touch) {
            if (!r.clients.has(client.id) && r.clients.size >= 100) throw new RelayError(429, "Room client limit reached")
            r.touched = now
            r.clients.set(client.id, { client: clone(client), seen: now })
        }
        let elected = false
        if (touch && !client.canSequence && r.owner?.id === client.id) {
            r.owner = null; r.lease = ""; elected = true
        }
        if (touch && !this.alive(r) && client.canSequence) {
            r.owner = clone(client); r.lease = randomUUID(); r.seen = now
            r.engine ||= clone(client.engine)
            elected = true
        }
        const role = client.canSequence && this.alive(r) && r.owner?.id === client.id ? "sequencer" : client.canSequence ? "editor" : "observer"
        if (touch && role === "sequencer") r.seen = now
        const changed = input.epoch !== r.epoch || input.revision !== r.revision || input.role !== role
            || (!this.alive(r) && client.canSequence)
        const stale = !r.sequence || now - r.updated >= STALE_MS
        const results = (r.results.get(client.id) || []).filter(x => x.id > (input.resultsAfter || 0))
        const out: any = { epoch: r.epoch, revision: r.revision, settingsRevision: r.settingsRevision,
            role, sequencer: this.alive(r) ? r.owner?.callsign : null, engine: r.engine,
            stale, updated: r.updated || null, users: [...r.clients.values()].map(x => ({ callsign: x.client.callsign, engine: x.client.engine })) }
        if (changed) { out.sequence = stale ? null : clone(r.sequence); out.checkpoint = clone(r.checkpoint); out.settings = clone(r.settings) }
        if (role === "sequencer") { out.lease = r.lease; out.commands = clone(r.commands) }
        if (results.length) out.results = clone(results)
        // Never send supervisory diagnostics to ordinary poll clients.
        if (elected) this.notify(r)
        return { data: out, changed: changed || results.length > 0 || (role === "sequencer" && r.commands.length > 0) }
    }
    private retry(r: Room, client: Client, kind: string, input: any) {
        if (typeof input.requestId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(input.requestId)) throw new RelayError(400, "Missing or invalid requestId")
        const key = `${client.id}/${kind}/${input.requestId}`
        const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex")
        const old = r.retries.get(key)
        if (old && old.fingerprint !== fingerprint) throw new RelayError(409, "requestId already used with another payload")
        return { key, fingerprint, old }
    }
    private remember(r: Room, retry: ReturnType<AmanRooms["retry"]>, response: unknown) {
        if (r.retries.size >= LIMIT * 2) throw new RelayError(429, "Too many requests; retry later")
        r.retries.set(retry.key, { fingerprint: retry.fingerprint, response: clone(response), at: this.now() })
    }
    publish(key: string, client: Client, input: any) {
        const r = this.get(key)
        this.expire(r)
        if (r.engine && !compatible(r.engine, client.engine)) throw new RelayError(409, "Different engine or state schema")
        if (!this.alive(r) || r.owner?.id !== client.id || input.lease !== r.lease || input.epoch !== r.epoch)
            throw new RelayError(409, "Sequencer lease lost; poll before publishing")
        const retry = this.retry(r, client, "publish", input)
        if (retry.old) return clone(retry.old.response)
        this.check(r, input.epoch, input.revision)
        if (input.settingsRevision !== r.settingsRevision) throw new RelayError(409, "Settings changed; poll before calculating")
        const sequence = input.sequence
        if (!sequence || typeof sequence !== "object" || !sequence.data || !Array.isArray(sequence.sequence)
            || sequence.sequence.length > 2000 || sequence.data.icao !== key.split("/")[1]) throw new RelayError(400, "Invalid MAESTRO sequence or airport mismatch")
        if (!input.checkpoint || typeof input.checkpoint !== "object" || Array.isArray(input.checkpoint)) throw new RelayError(400, "Missing recovery checkpoint")
        bounded(input.checkpoint, 1_000_000)
        bounded(input.supervision ?? null, 250_000)
        bounded(sequence, 500_000)
        const results = input.results ?? []
        if (!Array.isArray(results) || results.length > LIMIT) throw new RelayError(400, "Invalid command results")
        const ids = new Set<number>()
        for (const result of results) {
            if (!Number.isSafeInteger(result.id) || typeof result.ok !== "boolean" || typeof result.message !== "string"
                || result.message.length > 500 || ids.has(result.id) || !r.commands.some(c => c.id === result.id)) throw new RelayError(400, "Unknown or invalid command result")
            ids.add(result.id)
        }
        if (r.retries.size >= LIMIT * 2) throw new RelayError(429, "Too many requests; retry later")
        r.sequence = clone(sequence); r.checkpoint = clone(input.checkpoint); r.supervision = clone(input.supervision ?? null)
        r.updated = r.seen = r.touched = this.now(); r.engine = clone(client.engine); r.revision++
        for (const result of results) {
            const cmd = r.commands.find(c => c.id === result.id)!
            this.result(r, cmd.from, { id: result.id, ok: result.ok, message: result.message, at: this.now() })
        }
        r.commands = r.commands.filter(c => !ids.has(c.id))
        const response = { epoch: r.epoch, revision: r.revision }
        this.remember(r, retry, response); this.notify(r)
        return response
    }
    command(key: string, client: Client, input: any) {
        const r = this.get(key)
        this.expire(r)
        if (r.engine && !compatible(r.engine, client.engine)) throw new RelayError(409, "Different engine or state schema")
        const retry = this.retry(r, client, "command", input)
        if (retry.old) return clone(retry.old.response)
        this.check(r, input.epoch, input.revision)
        if (!this.alive(r)) throw new RelayError(503, "No active sequencer")
        if (!input.cmd || typeof input.cmd !== "object" || Array.isArray(input.cmd)
            || typeof input.cmd.op !== "string" || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(input.cmd.op)) throw new RelayError(400, "Invalid command")
        if (/^(settings|supervision|reset)$/i.test(input.cmd.op)) throw new RelayError(403, "Use the supervisory endpoint")
        bounded(input.cmd, 32_000)
        if (r.commands.length >= LIMIT || r.retries.size >= LIMIT * 2) throw new RelayError(429, "Command queue full")
        const id = r.nextId++
        r.commands.push({ id, from: client.id, cmd: clone(input.cmd), at: this.now() })
        r.touched = this.now()
        const response = { id, epoch: r.epoch, revision: r.revision }
        this.remember(r, retry, response); this.notify(r)
        return response
    }
    settings(key: string, input: any) {
        const r = this.get(key)
        this.check(r, input.epoch, input.revision)
        if (!input.settings || typeof input.settings !== "object" || Array.isArray(input.settings)) throw new RelayError(400, "Invalid settings")
        bounded(input.settings, 64_000)
        r.settings = clone(input.settings); r.settingsRevision++; r.revision++; r.touched = this.now()
        this.notify(r)
        return { epoch: r.epoch, revision: r.revision, settingsRevision: r.settingsRevision }
    }
    supervision(key: string) {
        const r = this.get(key)
        return clone({ epoch: r.epoch, revision: r.revision, settingsRevision: r.settingsRevision, settings: r.settings,
            engine: r.engine, supervision: r.supervision, stale: !r.sequence || this.now() - r.updated >= STALE_MS })
    }
    sequence(key: string) {
        const r = this.rooms.get(key)
        if (!r?.sequence || this.now() - r.updated >= STALE_MS) throw new RelayError(404, "No fresh sequence")
        return clone(r.sequence)
    }
    leave(key: string, client: Client) {
        const r = this.get(key)
        r.clients.delete(client.id)
        if (r.owner?.id === client.id) { r.owner = null; r.lease = "" }
        this.notify(r)
        return { left: true }
    }
    reset(key: string, input: any) {
        const r = this.get(key)
        this.check(r, input.epoch, input.revision)
        // Keep listener registrations until their pending HTTP polls have been answered.
        r.epoch = randomUUID(); r.revision = 0; r.settingsRevision = 0; r.settings = {}; r.engine = null
        r.sequence = r.checkpoint = r.supervision = null; r.updated = 0; r.owner = null; r.lease = ""
        r.commands = []; r.nextId = 1; r.results.clear(); r.retries.clear(); r.clients.clear(); r.touched = this.now()
        this.notify(r)
        return { epoch: r.epoch, revision: 0 }
    }
    subscribe(key: string, listener: () => void) {
        const r = this.get(key)
        r.listeners.add(listener)
        return () => { r.listeners.delete(listener) }
    }
    sweep() {
        for (const [key, r] of this.rooms) {
            this.expire(r)
            if (!this.alive(r)) this.notify(r)
            if (this.now() - r.touched >= IDLE_MS && !r.listeners.size) this.rooms.delete(key)
        }
    }
}
