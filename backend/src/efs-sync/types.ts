export type EfsRealm = "live" | "sweatbox" | "playback" | "local"

export const EFS_REALMS: EfsRealm[] = ["live", "sweatbox", "playback", "local"]

export type StripKey = string

export interface StrokePayload {
    points: string
    color: "blue" | "red" | "black" | string
    tag?: string
}

/** EFS-only strip fields — no EuroScope/esdata status. */
export interface StripMeta {
    callsign?: string
    kind?: "aircraft" | "vehicle" | "note" | "special" | string
    bayId?: string
    sectionId?: string
    position?: number
    clearanceRead?: boolean
    qnhGiven?: boolean
    atisGiven?: boolean
    noteText?: string
    [k: string]: unknown
}

export interface StripSyncRecord {
    stripKey: StripKey
    strip?: StripMeta
    strokes?: StrokePayload[]
    updatedAt: string
    updatedByCid?: number
}

export interface EssaSep {
    sep?: string | number
    dlv?: string | number
    depGap?: string | number
}

export interface AirportMeta {
    essaSep?: EssaSep
    /** ESSA runway config id from TWR ES (e.g. "1", "9A") */
    essaConfig?: string
    updatedAt?: string
    updatedByCid?: number
}

export interface OrderEntry {
    stripKey: StripKey
    bayId: string
    sectionId: string
    position: number
}

export interface AirportOrder {
    revision: number
    entries: OrderEntry[]
    updatedAt?: string
    updatedByCid?: number
}

export interface EfsColumn {
    id: string
    callsigns: string[]
}

export interface AirportSyncSnapshot {
    realm: EfsRealm
    airport: string
    efsActive: boolean
    updatedAt: string
    order?: AirportOrder
    strips: Record<StripKey, StripSyncRecord>
    meta?: AirportMeta
    columns?: EfsColumn[]
    sep?: EssaSep
}

/** Keys that must never appear on strip sync payloads (esdata owns these). */
export const FORBIDDEN_ES_KEYS = [
    "groundstate",
    "clearance",
    "clearence",
    "clearedForTakeoff",
    "cfto",
    "depRwy",
    "arrRwy",
    "sid",
    "stand",
    "cfl",
    "temporaryAltitude",
    "clearedAltitude",
    "ownership",
    "nextSector",
    "appDepNextSector",
    "atd",
    "squawk",
    "aircraft",
    "type",
    "wtc",
    "flightRules",
] as const

export const TWR_BAYS = new Set(["TWR-W", "TWR-E"])
export const SECTION_ORDER = ["TAXI", "LINEUP", "DEPA"]

export const EFS_SYNC_TTL_MS = 5 * 60 * 1000
