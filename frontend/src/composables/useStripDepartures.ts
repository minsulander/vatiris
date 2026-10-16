import { computed, onMounted, onUnmounted, type Ref } from "vue"
import { useVatsimStore } from "@/stores/vatsim"
import { useEsdataStore } from "@/stores/esdata"
import { useEfsStore } from "@/stores/efs"
import { useWxStore } from "@/stores/wx"
import { useWxOpsStore } from "@/stores/wxOps"
import { useAircraftStore } from "@/stores/aircraft"
import { useAuthStore } from "@/stores/auth"
import { useFdpStore } from "@/stores/fdp"
import {
    distanceToRunwayThreshold,
    getSIDName,
    normalizeFlightRules,
} from "@/flightcalc"
import constants from "@/constants"
import { computeEssaSepPreload, isDepRwyNonStandard, normalizeEssaRwy } from "@/striptv/essaSep"
import { isEssaEastSidBox, isSidAmberHighlight } from "@/striptv/sidHighlight"
import {
    GRP_TOF_ROLL_GS_KT,
    pruneStripAtd,
    resolveEssaStripTvConfigId,
    resolveStripAtd,
} from "@/striptv/essaConfig"
import type { EfsSepParams } from "@/stores/efs"

export type StripColumnMode = "essa-twr" | "paper"

export interface StripFlight {
    callsign: string
    type: string
    wtc: string | undefined
    flightRules: string | undefined
    runway: string | undefined
    sid: string | undefined
    /** TMA exit (for vector SID display) */
    tmaExit: string | undefined
    stand: string | undefined
    groundstate: string | undefined
    adep: string
    ades: string | undefined
    squawk: string | undefined
    std: string | undefined
    /** ATD (hhmm) — CFTO+GS>40, or GS>40 if no ground state; shown above △ */
    atd: string | undefined
    /** Cleared for takeoff / DEPA — green △ (not ATD) */
    cfto: boolean
    /** EuroScope temporary altitude (feet / FL / 1=CA / 2=VA) */
    cfl: string | number | undefined
    rfl: string | number | undefined
    xfl: string | number | undefined
    latitude?: number
    longitude?: number
    thrDistanceNm: number
    /** Amber SID (uncleared / VFR / vector / SLOW) */
    sidAmber: boolean
    /** ESSA black SID box (DEP-E / ARR-E) */
    sidEastBox: boolean
    /** Yellow RWY — not ES-active and/or outside ESSA config */
    rwyNonStandard: boolean
    cleared?: boolean
}

export interface StripColumn {
    id: string
    title: string
    flights: StripFlight[]
}

const TAXI_PLUS = new Set(["TAXI", "LINEUP", "DEPA"])

const ESSA_TWR_W = new Set(["01L", "19R", "08", "26"])
const ESSA_TWR_E = new Set(["01R", "19L"])

const PAPER_GS: { [col: string]: string } = {
    PA_TAXI: "TAXI",
    PA_BANAN: "LINEUP",
    UTFLYGNING: "DEPA",
}

function parseDepRunwayFromWx(wxHtml: string): string | undefined {
    if (!wxHtml) return undefined
    const el = document.createElement("div")
    el.innerHTML = wxHtml
    const clean = el.innerText.replace(/RUNWAY IN USE:\s*/i, "").trim()
    const m = clean.match(/DEP:\s*(\d{2}[LRC]?)/i)
    return m?.[1]?.toUpperCase()
}

function essaColumnForRunway(rwy: string | undefined): string {
    if (!rwy) return "TWR-W"
    const r = rwy.toUpperCase()
    if (ESSA_TWR_E.has(r)) return "TWR-E"
    if (ESSA_TWR_W.has(r)) return "TWR-W"
    return "TWR-W"
}

export function useStripDepartures(options: {
    icao: Ref<string> | string
    view?: string
    mode: StripColumnMode
    columnDefs: { id: string; title: string }[]
}) {
    const view = options.view || "DEP"
    const vatsim = useVatsimStore()
    const esdata = useEsdataStore()
    const efs = useEfsStore()
    const wx = useWxStore()
    const wxOps = useWxOpsStore()
    const aircraft = useAircraftStore()
    const auth = useAuthStore()
    const fdp = useFdpStore()

    let esSub: string | undefined
    let efsSub: string | undefined
    let wxSub: string | undefined
    let wxOpsSub: string | undefined
    let fdpSub: string | undefined

    const icaoRef = computed(() =>
        typeof options.icao === "string" ? options.icao : options.icao.value,
    )

    onMounted(() => {
        const icao = icaoRef.value
        esSub = esdata.subscribe()
        efsSub = efs.subscribe(icao, view)
        wxSub = wx.subscribe(icao)
        wxOpsSub = wxOps.subscribe(icao)
        fdpSub = fdp.subscribe()
    })

    onUnmounted(() => {
        if (esSub) esdata.unsubscribe(esSub)
        if (efsSub) efs.unsubscribe(efsSub)
        if (wxSub) wx.unsubscribe(wxSub)
        if (wxOpsSub) wxOps.unsubscribe(wxOpsSub)
        if (fdpSub) fdp.unsubscribe(fdpSub)
    })

    /** All ES-active / AWOS DEP runways for this airport (for non-standard RWY check). */
    const activeDepRunways = computed((): string[] => {
        const icao = icaoRef.value
        const out: string[] = []
        const cid = auth.user?.cid
        if (cid && vatsim.data?.controllers) {
            const controller = vatsim.data.controllers.find((c: any) => c.cid == cid)
            if (controller) {
                const mine = esdata.data[controller.callsign]
                const cfg = mine?.rwyconfig?.[icao]
                if (cfg && typeof cfg === "object") {
                    for (const [rwy, flags] of Object.entries(cfg)) {
                        if (rwy === "arr" || rwy === "dep") continue
                        if ((flags as any)?.dep) out.push(normalizeEssaRwy(rwy))
                    }
                }
            }
        }
        if (out.length === 0) {
            const fromOps = wxOps.get(icao)?.runwayInUse?.dep
            if (fromOps) out.push(normalizeEssaRwy(fromOps))
            else {
                const fromWx = parseDepRunwayFromWx(wx.rwy(icao))
                if (fromWx) out.push(normalizeEssaRwy(fromWx))
            }
        }
        return out.filter(Boolean)
    })

    const activeDepRunway = computed(() => activeDepRunways.value[0])

    function enrichCallsign(callsign: string): StripFlight | null {
        const icao = icaoRef.value
        const cs = callsign.toUpperCase()
        const pilot = (vatsim.data?.pilots || []).find((p) => p.callsign === cs)
        const prefile = (vatsim.data?.prefiles || []).find((p) => p.callsign === cs)
        const es = esdata.data[cs] || {}
        const fp = pilot?.flight_plan || prefile?.flight_plan

        const adep = fp?.departure || icao
        // When EFS sync is live, order membership is authoritative — still enrich even if FP adep mismatches
        if (adep !== icao && !efs.isActive(icao, view)) return null

        const type = fp?.aircraft_short || fp?.aircraft || es.aircraft || es.type || ""
        const route = fp?.route
        const flightRules =
            normalizeFlightRules(fp?.flight_rules, route) ||
            (es.flightRules ? String(es.flightRules) : undefined)
        const runway = (es.depRwy || activeDepRunway.value || undefined)?.toUpperCase()
        const metreport = wx.metreport(icao)
        const sid =
            es.sid ||
            getSIDName(icao, route, runway, metreport, flightRules) ||
            undefined

        const lat = pilot?.latitude
        const lon = pilot?.longitude
        const thrDistanceNm =
            lat != null && lon != null && runway
                ? distanceToRunwayThreshold({ latitude: lat, longitude: lon }, icao, runway)
                : Infinity

        const cleared = es.clearence === true || es.clearance === true
        const gs = (es.groundstate || "").toUpperCase()
        // △ = CFTO clearance / DEPA state (not the same as ATD)
        const cftoFlag = es.clearedForTakeoff === true || es.cfto === true
        const cfto = cftoFlag || gs === "DEPA"
        // ATD = CFTO + GS>40; if no ground state at all, GS>40 alone is enough
        const groundspeed = Number(pilot?.groundspeed)
        const noGroundState = !gs
        const rollStarted =
            Number.isFinite(groundspeed) &&
            groundspeed > GRP_TOF_ROLL_GS_KT &&
            (cftoFlag || noGroundState)
        const atd = resolveStripAtd({ callsign: cs, rollStarted })
        const tmaExit =
            (es.tmaExit && String(es.tmaExit)) ||
            (es.tma_exit && String(es.tma_exit)) ||
            undefined
        const cfl = es.cfl ?? es.clearedAltitude ?? es.temporaryAltitude
        const rfl = es.rfl ?? es.finalAltitude ?? fp?.altitude
        const xfl = es.xfl ?? es.exitFlightLevel
        const appDepNextSector = es.appDepNextSector || es.nextSector || undefined
        const sidAmber = isSidAmberHighlight({ sid, flightRules, cleared })
        const sidEastBox = isEssaEastSidBox({
            sid,
            depRwy: runway,
            appDepNextSector,
            adep: icao,
        })
        const arrRwy =
            wxOps.get(icao)?.runwayInUse?.arr ||
            wxOps.get(icao, activeDepRunway.value)?.runwayInUse?.arr
        const rwyNonStandard = isDepRwyNonStandard({
            runway,
            activeDepRunways: activeDepRunways.value,
            arrRunway: arrRwy,
            icao,
        })

        return {
            callsign: cs,
            type,
            wtc: aircraft.getWTC(type) || es.wtc,
            flightRules,
            runway,
            sid,
            tmaExit,
            stand: es.stand,
            groundstate: es.groundstate,
            adep: icao,
            ades: fp?.arrival,
            squawk: fp?.assigned_transponder || es.squawk,
            std: fp?.deptime,
            atd,
            cfto,
            cfl,
            rfl,
            xfl,
            latitude: lat,
            longitude: lon,
            thrDistanceNm,
            sidAmber,
            sidEastBox,
            rwyNonStandard,
            cleared,
        }
    }

    function collectFallbackFlights(): StripFlight[] {
        const icao = icaoRef.value
        const out: StripFlight[] = []
        const seen = new Set<string>()

        const consider = (p: any) => {
            const fp = p.flight_plan
            if (!fp || fp.departure !== icao) return
            const cs = p.callsign
            if (seen.has(cs)) return
            const es = esdata.data[cs]
            const gs = es?.groundstate
            if (!gs || !TAXI_PLUS.has(gs)) return

            // No-EFS only: drop once past 1000 ft (avoids sticky airborne strips)
            const alt = typeof p.altitude === "number" ? p.altitude : Number(p.altitude)
            if (Number.isFinite(alt) && alt > 1000) return

            // Skip if clearly airborne / far from airport when we have position
            if (p.latitude != null && p.groundspeed > 50) {
                const fdpRec = fdp.fdp?.flights?.[cs]
                const depDist = fdpRec?.departure_distance
                if (typeof depDist === "number" && depDist > constants.atAirportDistance) return
            }

            const flight = enrichCallsign(cs)
            if (flight) {
                seen.add(cs)
                out.push(flight)
            }
        }

        for (const p of vatsim.data?.pilots || []) consider(p)
        for (const p of vatsim.data?.prefiles || []) consider(p)
        return out
    }

    const efsActive = computed(() => efs.isActive(icaoRef.value, view))

    function placeholderFlight(callsign: string): StripFlight {
        const icao = icaoRef.value
        return {
            callsign: callsign.toUpperCase(),
            type: "",
            wtc: undefined,
            flightRules: undefined,
            runway: undefined,
            sid: undefined,
            tmaExit: undefined,
            stand: undefined,
            groundstate: undefined,
            adep: icao,
            ades: undefined,
            squawk: undefined,
            std: undefined,
            atd: undefined,
            cfto: false,
            cfl: undefined,
            rfl: undefined,
            xfl: undefined,
            thrDistanceNm: Infinity,
            sidAmber: false,
            sidEastBox: false,
            rwyNonStandard: false,
        }
    }

    const columns = computed((): StripColumn[] => {
        const icao = icaoRef.value
        const defs = options.columnDefs

        // Track Pinia reactive sync state
        void efs.efsActive
        void efs.columns
        void efs.snapshots

        let result: StripColumn[]

        // EFS live: Strip TV shows ONLY synced order callsigns (join esdata for status)
        if (efs.isActive(icao, view)) {
            const syncedCols = efs.getColumns(icao, view)
            result = defs.map((def) => {
                const col = syncedCols.find((c) => c.id === def.id)
                const flights = (col?.callsigns || []).map(
                    (cs) => enrichCallsign(cs) || placeholderFlight(cs),
                )
                return { id: def.id, title: def.title, flights }
            })
        } else {
            // Fallback: no EFS — esdata/VATSIM heuristic list only when sync inactive
            const all = collectFallbackFlights()
            result = defs.map((def) => {
                let flights: StripFlight[]
                if (options.mode === "essa-twr") {
                    flights = all.filter((f) => essaColumnForRunway(f.runway) === def.id)
                } else {
                    const wantGs = PAPER_GS[def.id]
                    flights = all.filter((f) => f.groundstate === wantGs)
                }
                flights = [...flights].sort((a, b) => a.thrDistanceNm - b.thrDistanceNm)
                return { id: def.id, title: def.title, flights }
            })
        }

        pruneStripAtd(result.flatMap((c) => c.flights.map((f) => f.callsign)))
        return result
    })

    const ops = computed(() => {
        const icao = icaoRef.value
        const rwy = activeDepRunway.value
        return (rwy && wxOps.get(icao, rwy)) || wxOps.get(icao)
    })

    const activeArrRunway = computed(() => {
        return ops.value?.runwayInUse?.arr || undefined
    })

    /**
     * SEP / DLV / DEP GAP / INFO:
     * - EFS active → synced values; INFO empty (unless EFS sends info)
     * - No EFS → preload from vatefs rules; INFO = "NO EFS"
     */
    const sep = computed((): EfsSepParams | undefined => {
        const icao = icaoRef.value
        if (icao !== "ESSA" && options.mode !== "essa-twr") {
            if (!efs.isActive(icao, view)) return undefined
            const synced = efs.getSep(icao, view)
            return { ...synced, info: "" }
        }

        if (efs.isActive(icao, view)) {
            const synced = efs.getSep(icao, view)
            return {
                sep: synced?.sep,
                dlv: synced?.dlv,
                depGap: synced?.depGap,
                info: "", // EFS live → INFO empty
            }
        }

        const o = ops.value
        return computeEssaSepPreload({
            arrRunway: o?.runwayInUse?.arr || activeArrRunway.value,
            depRunway: o?.runwayInUse?.dep || activeDepRunway.value,
            sccAll: o?.sccAll,
            flightCategory: o?.flightCategory,
            noEfs: true,
        })
    })

    /** ESSA bankonfig number for Strip TV header (1, 9A, …). */
    const rwyConfigId = computed((): string | null => {
        void esdata.data
        void esdata.lastReceivedAt
        void efs.snapshots
        void vatsim.data
        const icao = icaoRef.value
        if (icao !== "ESSA") return null
        return resolveEssaStripTvConfigId({
            efsActive: efs.isActive(icao, view),
            efsConfigId: efs.getEssaConfig(icao, view),
            esdataAll: esdata.data,
            atis: vatsim.data?.atis,
            wxRwyHtml: wx.rwy(icao),
        })
    })

    return {
        columns,
        efsActive,
        ops,
        sep,
        activeDepRunway,
        rwyConfigId,
        icao: icaoRef,
    }
}
