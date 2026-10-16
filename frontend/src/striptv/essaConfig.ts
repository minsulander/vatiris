/**
 * ESSA Strip TV runway-config number (1, 9A, …) — same combinations as SEP preload / QuickRef.
 */
import moment from "moment"
import { normalizeEssaRwy, resolveEssaRwyConfigId } from "@/striptv/essaSep"

/** QuickRef-style ARR/DEP pair from ATIS + WX (no EFS / no ES rwyconfig). */
export function resolveEssaArrDepFromAtisWx(options: {
    atis?: { callsign: string; text_atis?: string[] }[] | null
    wxRwyHtml?: string
}): { arr: string[]; dep: string[] } {
    let arr = ""
    let dep = ""
    const list = options.atis || []
    const arrAtis = list.find((a) => a.callsign === "ESSA_A_ATIS")
    const depAtis = list.find((a) => a.callsign === "ESSA_D_ATIS")
    if (arrAtis?.text_atis && depAtis?.text_atis) {
        const arrMatch = arrAtis.text_atis.join(" ").match(/RWY\s+(\d{2}[LRC]?) IN USE/i)
        const depMatch = depAtis.text_atis.join(" ").match(/RWY\s+(\d{2}[LRC]?) IN USE/i)
        if (arrMatch?.[1]) arr = arrMatch[1]
        if (depMatch?.[1]) dep = depMatch[1]
    }
    if ((!arr || !dep) && options.wxRwyHtml) {
        const rwyText = options.wxRwyHtml.replace(/<[^>]*>?/gm, "")
        const match = rwyText.match(/ARR:\s*(\d{2}[LRC]?)\s*DEP:\s*(\d{2}[LRC]?)/i)
        if (match) {
            if (!arr) arr = match[1]
            if (!dep) dep = match[2]
        }
    }
    return {
        arr: arr ? [normalizeEssaRwy(arr)] : [],
        dep: dep ? [normalizeEssaRwy(dep)] : [],
    }
}

/** Parse EuroScope plugin rwyconfig[ESSA] into ARR/DEP runway lists. */
export function resolveEssaArrDepFromEsRwyConfig(rwyconfig: any): { arr: string[]; dep: string[] } {
    const arr: string[] = []
    const dep: string[] = []
    if (!rwyconfig || typeof rwyconfig !== "object") return { arr, dep }
    for (const [rwy, flags] of Object.entries(rwyconfig)) {
        if (rwy === "arr" || rwy === "dep") continue
        const f = flags as any
        if (f?.arr) arr.push(normalizeEssaRwy(rwy))
        if (f?.dep) dep.push(normalizeEssaRwy(rwy))
    }
    return { arr, dep }
}

/** First ESSA rwyconfig found in esdata (TWR/GND plugin publish). */
export function findEssaEsRwyConfig(esdataAll: Record<string, any>): any | undefined {
    for (const rec of Object.values(esdataAll || {})) {
        const cfg = rec?.rwyconfig?.ESSA
        if (cfg && typeof cfg === "object") {
            const { arr, dep } = resolveEssaArrDepFromEsRwyConfig(cfg)
            if (arr.length || dep.length) return cfg
        }
    }
    return undefined
}

/**
 * Config id for Strip TV header (e.g. "1", "9A").
 * - efsActive: prefer EFS meta.essaConfig, else TWR ES rwyconfig, else ATIS/WX
 * - !efsActive: ATIS/WX auto (same idea as QuickRef)
 */
export function resolveEssaStripTvConfigId(options: {
    efsActive: boolean
    /** From EFS sync meta when VatEFS publishes bankonfig */
    efsConfigId?: string | null
    esdataAll?: Record<string, any>
    atis?: { callsign: string; text_atis?: string[] }[] | null
    wxRwyHtml?: string
    now?: Date
}): string | null {
    if (options.efsActive) {
        const fromEfs = String(options.efsConfigId || "")
            .trim()
            .toUpperCase()
        if (fromEfs) return fromEfs.replace(/^0+/, "") || fromEfs

        const cfg = findEssaEsRwyConfig(options.esdataAll || {})
        if (cfg) {
            const { arr, dep } = resolveEssaArrDepFromEsRwyConfig(cfg)
            const id = resolveEssaRwyConfigId(arr, dep, options.now)
            if (id) return id
        }
    }

    const { arr, dep } = resolveEssaArrDepFromAtisWx({
        atis: options.atis,
        wxRwyHtml: options.wxRwyHtml,
    })
    return resolveEssaRwyConfigId(arr, dep, options.now)
}

/**
 * Latch ATD (HHMM UTC) on takeoff roll (GS > 40 kt): normally needs CFTO;
 * if no ground state is set, GS alone is enough.
 * Roll threshold matches Ground Radar Departure Timer (General §7.2).
 */
const atdLatch = new Map<string, string>()

/** GRP Dep Timer threshold (kt) — see Ground Radar plugin General §7.2 */
export const GRP_TOF_ROLL_GS_KT = 40

export function resolveStripAtd(options: {
    callsign: string
    /** True when CFTO + GS > GRP_TOF_ROLL_GS_KT — latches once until prune. */
    rollStarted: boolean
}): string | undefined {
    const cs = options.callsign.toUpperCase()
    if (atdLatch.has(cs)) return atdLatch.get(cs)
    if (!options.rollStarted) return undefined
    atdLatch.set(cs, moment.utc().format("HHmm"))
    return atdLatch.get(cs)
}

/** Drop ATD latches for callsigns no longer on the board. */
export function pruneStripAtd(activeCallsigns: Iterable<string>) {
    const keep = new Set([...activeCallsigns].map((c) => c.toUpperCase()))
    for (const cs of atdLatch.keys()) {
        if (!keep.has(cs)) atdLatch.delete(cs)
    }
}
