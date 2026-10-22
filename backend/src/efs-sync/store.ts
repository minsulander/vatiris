import type { WebSocket } from "ws"
import {
    AirportMeta,
    AirportOrder,
    AirportSyncSnapshot,
    EfsColumn,
    EfsRealm,
    EssaSep,
    EssaSepOverrides,
    EFS_SYNC_TTL_MS,
    FORBIDDEN_ES_KEYS,
    OrderEntry,
    SECTION_ORDER,
    StripKey,
    StripMeta,
    StripSyncRecord,
    StrokePayload,
    TWR_BAYS,
} from "./types"

export type WsClient = WebSocket

interface SyncSocket {
    ws: WebSocket
    cid: number
}

interface RoomState {
    realm: EfsRealm
    airport: string
    strips: Record<StripKey, StripSyncRecord>
    order?: AirportOrder
    meta?: AirportMeta
    updatedAt: string
    clients: Set<SyncSocket>
}

const rooms = new Map<string, RoomState>()

function roomKey(realm: string, airport: string) {
    return `${realm.toLowerCase()}/${airport.toUpperCase()}`
}

function nowIso() {
    return new Date().toISOString()
}

function getOrCreate(realm: EfsRealm, airport: string): RoomState {
    const key = roomKey(realm, airport)
    let room = rooms.get(key)
    if (!room) {
        room = {
            realm,
            airport: airport.toUpperCase(),
            strips: {},
            updatedAt: nowIso(),
            clients: new Set(),
        }
        rooms.set(key, room)
    }
    return room
}

export function findForbiddenEsKeys(obj: unknown, path = ""): string[] {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return []
    const found: string[] = []
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const p = path ? `${path}.${k}` : k
        if ((FORBIDDEN_ES_KEYS as readonly string[]).includes(k)) found.push(p)
        if (v && typeof v === "object" && !Array.isArray(v)) {
            found.push(...findForbiddenEsKeys(v, p))
        }
    }
    return found
}

function sectionRank(sectionId: string): number {
    const i = SECTION_ORDER.indexOf(sectionId.toUpperCase())
    return i >= 0 ? i : SECTION_ORDER.length
}

/** EFS ATD: HHmm UTC, or null to clear. false/""/invalid → null. */
export function normalizeEfsAtd(raw: unknown): string | null {
    if (raw === null || raw === false || raw === undefined || raw === "") return null
    const digits = String(raw).replace(/\D/g, "")
    if (digits.length < 3 || digits.length > 4) return null
    return digits.padStart(4, "0")
}

export function normalizeEfsCfto(raw: unknown): boolean {
    return raw === true
}

export function deriveColumns(order?: AirportOrder): EfsColumn[] {
    const byBay: Record<string, OrderEntry[]> = { "TWR-W": [], "TWR-E": [] }
    for (const e of order?.entries || []) {
        const bay = String(e.bayId || "").toUpperCase()
        if (!TWR_BAYS.has(bay)) continue
        byBay[bay].push({
            stripKey: String(e.stripKey).toUpperCase(),
            bayId: bay,
            sectionId: String(e.sectionId || "TAXI").toUpperCase(),
            position: Number(e.position) || 0,
            cfto: normalizeEfsCfto(e.cfto),
            atd: normalizeEfsAtd(e.atd),
        })
    }
    for (const bay of Object.keys(byBay)) {
        byBay[bay].sort((a, b) => {
            const sr = sectionRank(a.sectionId) - sectionRank(b.sectionId)
            if (sr !== 0) return sr
            if (a.position !== b.position) return a.position - b.position
            return a.stripKey.localeCompare(b.stripKey)
        })
    }
    return [
        { id: "TWR-W", callsigns: byBay["TWR-W"].map((e) => e.stripKey) },
        { id: "TWR-E", callsigns: byBay["TWR-E"].map((e) => e.stripKey) },
    ]
}

const SEP_FIELDS = ["sep", "dlv", "depGap"] as const

/**
 * Bare SEP for storage. Strips a trailing "nm". Keeps "" so a blank DEP GAP
 * still round-trips as a string (peers require sep/dlv/depGap strings).
 */
export function normalizeSep(raw?: EssaSep | null): EssaSep | undefined {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
    const src = raw as Record<string, unknown>
    const stripNm = (v: unknown): string | number | undefined => {
        if (v === undefined || v === null) return undefined
        if (typeof v === "number") return Number.isFinite(v) ? v : undefined
        return String(v).replace(/\s*nm\s*/gi, "").trim()
    }
    const sep: EssaSep = {}
    for (const key of SEP_FIELDS) {
        if (!(key in src)) continue
        const v = stripNm(src[key])
        if (v !== undefined) sep[key] = v
    }
    return Object.keys(sep).length ? sep : undefined
}

export function parseEssaSepOverrides(
    raw: unknown,
): { ok: true; overrides: EssaSepOverrides } | { ok: false; error: string } {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: false, error: "essaSepOverrides must be an object" }
    }
    const src = raw as Record<string, unknown>
    const overrides: EssaSepOverrides = {}
    for (const key of SEP_FIELDS) {
        if (!(key in src)) continue
        const v = src[key]
        if (typeof v !== "string") {
            return { ok: false, error: `essaSepOverrides.${key} must be a string` }
        }
        if (v.length > 32) {
            return { ok: false, error: `essaSepOverrides.${key} too long` }
        }
        overrides[key] = v
    }
    return { ok: true, overrides }
}

/** Payload peers read. Display strings in `essaSepOverrides` are not rewritten. */
export function publicAirportMeta(meta: AirportMeta): {
    essaSep?: EssaSep
    essaConfig?: string
    essaSepOverrides?: EssaSepOverrides
} {
    const payload: {
        essaSep?: EssaSep
        essaConfig?: string
        essaSepOverrides?: EssaSepOverrides
    } = {}
    if (meta.essaSep) payload.essaSep = { ...meta.essaSep }
    if (meta.essaConfig) payload.essaConfig = meta.essaConfig
    if (meta.essaSepOverrides) payload.essaSepOverrides = { ...meta.essaSepOverrides }
    return payload
}

export function isEfsActive(room: RoomState): boolean {
    const t = Date.parse(room.updatedAt)
    if (Number.isNaN(t)) return false
    return Date.now() - t < EFS_SYNC_TTL_MS
}

export function snapshot(realm: EfsRealm, airport: string): AirportSyncSnapshot {
    const room = getOrCreate(realm, airport)
    const active = isEfsActive(room)
    const sep = normalizeSep(room.meta?.essaSep)
    return {
        realm: room.realm,
        airport: room.airport,
        efsActive: active,
        updatedAt: room.updatedAt,
        order: room.order,
        strips: { ...room.strips },
        meta: room.meta,
        columns: deriveColumns(room.order),
        sep,
    }
}

function touch(room: RoomState, cid?: number) {
    room.updatedAt = nowIso()
    void cid
}

function broadcast(room: RoomState, msg: object, exceptCid?: number | null) {
    const data = JSON.stringify(msg)
    for (const client of room.clients) {
        if (exceptCid != null && client.cid === exceptCid) continue
        if (client.ws.readyState === 1 /* OPEN */) {
            try {
                client.ws.send(data)
            } catch {
                /* ignore */
            }
        }
    }
}

export function addClient(realm: EfsRealm, airport: string, ws: WsClient, cid: number) {
    const room = getOrCreate(realm, airport)
    room.clients.add({ ws, cid })
    ws.send(
        JSON.stringify({
            type: "hello",
            realm: room.realm,
            airport: room.airport,
            efsActive: isEfsActive(room),
            updatedAt: room.updatedAt,
        }),
    )
    const snap = snapshot(realm, airport)
    ws.send(JSON.stringify({ type: "snapshot", ...snap }))
}

export function removeClient(realm: EfsRealm, airport: string, ws: WsClient) {
    const room = rooms.get(roomKey(realm, airport))
    if (!room) return
    for (const client of room.clients) {
        if (client.ws === ws) room.clients.delete(client)
    }
}

/**
 * Client → server room messages. Only `reassertAssumed` is fanned out
 * (ephemeral; not stored). Other types and malformed JSON are ignored.
 * The publisher CID does not receive its own event.
 */
export function handleClientMessage(realm: EfsRealm, airport: string, cid: number, raw: unknown) {
    let msg: { type?: string } | null = null
    try {
        const parsed = JSON.parse(String(raw))
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            msg = parsed as { type?: string }
        }
    } catch {
        return
    }
    if (!msg || msg.type !== "reassertAssumed") return
    const room = rooms.get(roomKey(realm, airport))
    if (!room) return
    broadcast(
        room,
        {
            type: "reassertAssumed",
            updatedAt: nowIso(),
            updatedByCid: cid,
        },
        cid,
    )
}

export function putStrip(
    realm: EfsRealm,
    airport: string,
    stripKey: string,
    body: { strip?: StripMeta; strokes?: StrokePayload[] },
    cid: number,
): StripSyncRecord | { error: string } {
    const forbidden = findForbiddenEsKeys(body)
    if (forbidden.length) {
        return { error: `esdata fields not allowed: ${forbidden.join(", ")}` }
    }
    const key = String(stripKey).toUpperCase()
    const room = getOrCreate(realm, airport)
    touch(room, cid)
    const prev = room.strips[key]
    let strip: StripMeta | undefined =
        body.strip !== undefined ? { ...body.strip } : prev?.strip
    if (strip) {
        if ("cfto" in strip) strip.cfto = normalizeEfsCfto(strip.cfto)
        if ("atd" in strip) strip.atd = normalizeEfsAtd(strip.atd)
        if (strip.callsign) strip.callsign = String(strip.callsign).toUpperCase()
    }
    const record: StripSyncRecord = {
        stripKey: key,
        strip,
        strokes: body.strokes !== undefined ? body.strokes : prev?.strokes,
        updatedAt: room.updatedAt,
        updatedByCid: cid,
    }
    room.strips[key] = record
    broadcast(room, {
        type: "scribble",
        stripKey: key,
        strokes: record.strokes || [],
        strip: record.strip,
        updatedAt: record.updatedAt,
        updatedByCid: cid,
    })
    return record
}

export function deleteStrip(
    realm: EfsRealm,
    airport: string,
    stripKey: string,
    cid: number,
): { ok: true } | { error: string } {
    const key = String(stripKey).toUpperCase()
    const room = getOrCreate(realm, airport)
    touch(room, cid)
    delete room.strips[key]
    if (room.order) {
        room.order = {
            ...room.order,
            entries: room.order.entries.filter((e) => e.stripKey.toUpperCase() !== key),
            updatedAt: room.updatedAt,
            updatedByCid: cid,
        }
        broadcast(room, {
            type: "order",
            order: { revision: room.order.revision, entries: room.order.entries },
            updatedAt: room.updatedAt,
            updatedByCid: cid,
        })
    }
    broadcast(room, {
        type: "scribble",
        stripKey: key,
        strokes: [],
        updatedAt: room.updatedAt,
        updatedByCid: cid,
        deleted: true,
    })
    return { ok: true }
}

export function getStrip(realm: EfsRealm, airport: string, stripKey: string): StripSyncRecord | undefined {
    const room = rooms.get(roomKey(realm, airport))
    if (!room) return undefined
    return room.strips[String(stripKey).toUpperCase()]
}

export function putOrder(
    realm: EfsRealm,
    airport: string,
    body: { revision?: number; entries?: OrderEntry[] },
    cid: number,
): AirportOrder | { error: string } {
    if (!body || !Array.isArray(body.entries)) {
        return { error: "entries array required" }
    }
    const room = getOrCreate(realm, airport)
    const prevRev = room.order?.revision ?? 0
    const revision =
        body.revision != null && Number.isFinite(Number(body.revision))
            ? Number(body.revision)
            : prevRev + 1
    const entries: OrderEntry[] = body.entries.map((e, i) => ({
        stripKey: String(e.stripKey || "").toUpperCase(),
        bayId: String(e.bayId || "").toUpperCase(),
        sectionId: String(e.sectionId || "TAXI").toUpperCase(),
        position: Number(e.position) || i,
        cfto: normalizeEfsCfto((e as OrderEntry).cfto),
        atd: normalizeEfsAtd((e as OrderEntry).atd),
    }))
    touch(room, cid)
    const order: AirportOrder = {
        revision,
        entries,
        updatedAt: room.updatedAt,
        updatedByCid: cid,
    }
    room.order = order
    broadcast(room, {
        type: "order",
        order: { revision: order.revision, entries: order.entries },
        updatedAt: room.updatedAt,
        updatedByCid: cid,
    })
    return order
}

export function getOrder(realm: EfsRealm, airport: string): AirportOrder | undefined {
    return rooms.get(roomKey(realm, airport))?.order
}

export function putMeta(
    realm: EfsRealm,
    airport: string,
    body: { essaSep?: EssaSep; essaConfig?: string; essaSepOverrides?: EssaSepOverrides },
    cid: number,
): AirportMeta | { error: string } {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "JSON body required" }
    }
    const forbidden = findForbiddenEsKeys(body)
    if (forbidden.length) {
        return { error: `esdata fields not allowed: ${forbidden.join(", ")}` }
    }
    if (body.essaSep == null) {
        return { error: "essaSep required" }
    }
    if (typeof body.essaSep !== "object" || Array.isArray(body.essaSep)) {
        return { error: "essaSep must be an object" }
    }
    const essaSep = normalizeSep(body.essaSep)
    if (!essaSep) {
        return { error: "essaSep required" }
    }
    const hasOverrides = Object.prototype.hasOwnProperty.call(body, "essaSepOverrides")
    let nextOverrides: EssaSepOverrides | undefined
    if (hasOverrides) {
        if (body.essaSepOverrides === undefined) {
            return { error: "essaSepOverrides must be an object" }
        }
        const parsed = parseEssaSepOverrides(body.essaSepOverrides)
        if (!parsed.ok) return { error: parsed.error }
        nextOverrides = parsed.overrides
    }
    const room = getOrCreate(realm, airport)
    const prev = room.meta
    touch(room, cid)
    const essaConfigRaw = body.essaConfig != null ? String(body.essaConfig).trim() : prev?.essaConfig
    const meta: AirportMeta = {
        essaSep,
        essaConfig: essaConfigRaw || undefined,
        updatedAt: room.updatedAt,
        updatedByCid: cid,
    }
    if (hasOverrides) meta.essaSepOverrides = nextOverrides
    else if (prev?.essaSepOverrides) meta.essaSepOverrides = { ...prev.essaSepOverrides }
    room.meta = meta
    broadcast(room, {
        type: "meta",
        meta: publicAirportMeta(meta),
        updatedAt: room.updatedAt,
        updatedByCid: cid,
    })
    return meta
}

export function getMeta(realm: EfsRealm, airport: string): AirportMeta | undefined {
    return rooms.get(roomKey(realm, airport))?.meta
}

export function heartbeat(realm: EfsRealm, airport: string, cid: number) {
    const room = getOrCreate(realm, airport)
    touch(room, cid)
    broadcast(room, {
        type: "heartbeat",
        updatedAt: room.updatedAt,
        updatedByCid: cid,
        efsActive: isEfsActive(room),
    })
    return { updatedAt: room.updatedAt, efsActive: isEfsActive(room) }
}
