import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import { v4 as uuid } from "uuid"
import moment from "moment"
import axios from "axios"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

export type EfsRealm = "live" | "sweatbox" | "playback" | "local"

export interface EfsColumn {
    id: string
    callsigns: string[]
}

export interface EfsSepParams {
    sep?: number | string
    dlv?: number | string
    depGap?: number | string
    info?: string
}

export interface OrderEntry {
    stripKey: string
    bayId: string
    sectionId: string
    position: number
}

export interface AirportOrder {
    revision: number
    entries: OrderEntry[]
}

export interface AirportSyncSnapshot {
    realm: EfsRealm
    airport: string
    efsActive: boolean
    updatedAt: string
    order?: AirportOrder
    strips?: Record<string, unknown>
    meta?: { essaSep?: EfsSepParams }
    columns?: EfsColumn[]
    sep?: EfsSepParams
}

const TWR_BAYS = new Set(["TWR-W", "TWR-E"])
const SECTION_ORDER = ["TAXI", "LINEUP", "DEPA"]

function wsBaseUrl() {
    const u = new URL(backendBaseUrl)
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:"
    return u.origin
}

function sectionRank(sectionId: string) {
    const i = SECTION_ORDER.indexOf(sectionId.toUpperCase())
    return i >= 0 ? i : SECTION_ORDER.length
}

function columnsFromOrder(order?: AirportOrder): EfsColumn[] {
    const byBay: Record<string, OrderEntry[]> = { "TWR-W": [], "TWR-E": [] }
    for (const e of order?.entries || []) {
        const bay = String(e.bayId || "").toUpperCase()
        if (!TWR_BAYS.has(bay)) continue
        byBay[bay].push({
            stripKey: String(e.stripKey).toUpperCase(),
            bayId: bay,
            sectionId: String(e.sectionId || "TAXI").toUpperCase(),
            position: Number(e.position) || 0,
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

function stripNm(v: string | number | undefined) {
    if (v === undefined || v === null || v === "") return undefined
    if (typeof v === "number") return v
    return String(v).replace(/\s*nm\s*/gi, "").trim()
}

function normalizeSep(raw?: EfsSepParams | null): EfsSepParams | undefined {
    if (!raw) return undefined
    const sep: EfsSepParams = {}
    const s = stripNm(raw.sep)
    const d = stripNm(raw.dlv)
    const g = stripNm(raw.depGap)
    if (s !== undefined) sep.sep = s
    if (d !== undefined) sep.dlv = d
    if (g !== undefined) sep.depGap = g
    return Object.keys(sep).length ? sep : undefined
}

interface RoomClient {
    realm: EfsRealm
    airport: string
    ws?: WebSocket
    pollTimer?: ReturnType<typeof setInterval>
    reconnectTimer?: ReturnType<typeof setTimeout>
    refCount: number
}

export const useEfsStore = defineStore("efs", () => {
    const snapshots = reactive({} as { [key: string]: AirportSyncSnapshot | null })
    const efsActive = reactive({} as { [key: string]: boolean })
    const columns = reactive({} as { [key: string]: EfsColumn[] })
    const sepByKey = reactive({} as { [key: string]: EfsSepParams | undefined })
    const lastReceivedAt = reactive({} as { [key: string]: string })
    const subscriptions = reactive({} as { [id: string]: string })
    const rooms = reactive({} as { [key: string]: RoomClient })
    const loading = ref(false)
    /** Default realm until IRIS settings exist */
    const defaultRealm = ref<EfsRealm>("live")

    function key(realm: string, airport: string) {
        return `${realm.toLowerCase()}/${airport.toUpperCase()}`
    }

    function applySnapshot(k: string, snap: AirportSyncSnapshot) {
        snapshots[k] = snap
        efsActive[k] = !!snap.efsActive
        const cols = snap.columns?.length ? snap.columns : columnsFromOrder(snap.order)
        columns[k] = cols
        sepByKey[k] = normalizeSep(snap.sep || snap.meta?.essaSep)
        lastReceivedAt[k] = moment.utc().toISOString()
    }

    function applyWsMessage(k: string, msg: any) {
        if (!msg || typeof msg !== "object") return
        if (msg.type === "hello") return
        if (msg.type === "snapshot") {
            applySnapshot(k, msg as AirportSyncSnapshot)
            return
        }
        const cur: AirportSyncSnapshot = snapshots[k] || {
            realm: k.split("/")[0] as EfsRealm,
            airport: k.split("/")[1] || "",
            efsActive: true,
            updatedAt: msg.updatedAt || moment.utc().toISOString(),
            strips: {},
        }
        if (msg.type === "order" && msg.order) {
            cur.order = msg.order
            cur.updatedAt = msg.updatedAt || cur.updatedAt
            cur.efsActive = true
            cur.columns = columnsFromOrder(msg.order)
            applySnapshot(k, { ...cur })
            return
        }
        if (msg.type === "meta" && msg.meta) {
            cur.meta = msg.meta
            cur.sep = normalizeSep(msg.meta.essaSep)
            cur.updatedAt = msg.updatedAt || cur.updatedAt
            cur.efsActive = true
            applySnapshot(k, { ...cur })
            return
        }
        if (msg.type === "heartbeat") {
            cur.updatedAt = msg.updatedAt || cur.updatedAt
            cur.efsActive = msg.efsActive !== false
            applySnapshot(k, { ...cur })
            return
        }
        if (msg.type === "scribble") {
            // Strip TV ignores strokes; still refresh activity
            cur.updatedAt = msg.updatedAt || cur.updatedAt
            cur.efsActive = true
            applySnapshot(k, { ...cur })
        }
    }

    async function fetchSnapshot(realm: EfsRealm, airport: string) {
        const k = key(realm, airport)
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/efs/sync/${realm}/${airport}`)
            applySnapshot(k, res.data)
        } catch {
            snapshots[k] = null
            efsActive[k] = false
            columns[k] = []
            sepByKey[k] = undefined
        } finally {
            loading.value = false
        }
    }

    function stopPoll(room: RoomClient) {
        if (room.pollTimer) {
            clearInterval(room.pollTimer)
            room.pollTimer = undefined
        }
    }

    function startPoll(room: RoomClient) {
        stopPoll(room)
        room.pollTimer = setInterval(() => {
            fetchSnapshot(room.realm, room.airport)
        }, 5000)
    }

    function connectWs(room: RoomClient) {
        if (room.ws && (room.ws.readyState === WebSocket.OPEN || room.ws.readyState === WebSocket.CONNECTING)) {
            return
        }
        const k = key(room.realm, room.airport)
        // Anonymous read cid for WS gate (dev); prefer auth cid when available
        const cid =
            (window as any).auth?.user?.cid ||
            Number(localStorage.getItem("efsSyncCid")) ||
            1
        const url = `${wsBaseUrl()}/efs/sync/${room.realm}/${room.airport}/ws?cid=${cid}`
        try {
            const ws = new WebSocket(url)
            room.ws = ws
            ws.onopen = () => {
                stopPoll(room)
                fetchSnapshot(room.realm, room.airport)
            }
            ws.onmessage = (ev) => {
                try {
                    applyWsMessage(k, JSON.parse(String(ev.data)))
                } catch {
                    /* ignore */
                }
            }
            ws.onclose = () => {
                room.ws = undefined
                startPoll(room)
                if (room.refCount > 0) {
                    room.reconnectTimer = setTimeout(() => connectWs(room), 2000)
                }
            }
            ws.onerror = () => {
                try {
                    ws.close()
                } catch {
                    /* ignore */
                }
            }
        } catch {
            startPoll(room)
        }
    }

    function ensureRoom(realm: EfsRealm, airport: string) {
        const k = key(realm, airport)
        if (!rooms[k]) {
            rooms[k] = { realm, airport: airport.toUpperCase(), refCount: 0 }
        }
        return rooms[k]
    }

    function subscribe(airport: string, _view?: string, realm?: EfsRealm) {
        const r = realm || defaultRealm.value
        const subscriptionId = uuid()
        const k = key(r, airport)
        subscriptions[subscriptionId] = k
        const room = ensureRoom(r, airport)
        room.refCount++
        if (room.refCount === 1) {
            fetchSnapshot(r, airport)
            connectWs(room)
        }
        return subscriptionId
    }

    function unsubscribe(subscriptionId: string) {
        const k = subscriptions[subscriptionId]
        delete subscriptions[subscriptionId]
        if (!k) return
        const room = rooms[k]
        if (!room) return
        room.refCount = Math.max(0, room.refCount - 1)
        if (room.refCount === 0) {
            stopPoll(room)
            if (room.reconnectTimer) clearTimeout(room.reconnectTimer)
            try {
                room.ws?.close()
            } catch {
                /* ignore */
            }
            room.ws = undefined
        }
    }

    /** Compat: airport + view — view unused; realm from defaultRealm */
    function isActive(airport: string, _view?: string) {
        return !!efsActive[key(defaultRealm.value, airport)]
    }

    function getColumns(airport: string, _view?: string): EfsColumn[] {
        return columns[key(defaultRealm.value, airport)] || []
    }

    function getSep(airport: string, _view?: string): EfsSepParams | undefined {
        return sepByKey[key(defaultRealm.value, airport)]
    }

    /** @deprecated use getColumns — kept for transitional callers */
    function getLayout(airport: string, view?: string) {
        const cols = getColumns(airport, view)
        const sep = getSep(airport, view)
        const snap = snapshots[key(defaultRealm.value, airport)]
        if (!snap && !cols.length) return null
        return {
            source: "efs-sync",
            updatedAt: snap?.updatedAt || lastReceivedAt[key(defaultRealm.value, airport)] || "",
            columns: cols,
            sep,
            airport: airport.toUpperCase(),
            view: (view || "DEP").toUpperCase(),
            efsActive: isActive(airport, view),
        }
    }

    function latestDataTime(airport: string, _view?: string): string | null {
        const k = key(defaultRealm.value, airport)
        const candidates: moment.Moment[] = []
        const snap = snapshots[k]
        if (snap?.updatedAt) {
            const m = moment.utc(snap.updatedAt)
            if (m.isValid()) candidates.push(m)
        }
        if (lastReceivedAt[k]) {
            const m = moment.utc(lastReceivedAt[k])
            if (m.isValid()) candidates.push(m)
        }
        if (!candidates.length) return null
        return moment.max(...candidates).toISOString()
    }

    return {
        snapshots,
        efsActive,
        columns,
        lastReceivedAt,
        loading,
        defaultRealm,
        layouts: snapshots, // compat alias
        subscribe,
        unsubscribe,
        fetch: fetchSnapshot,
        isActive,
        getColumns,
        getSep,
        getLayout,
        latestDataTime,
    }
})
