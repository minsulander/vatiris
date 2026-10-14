import axios from "axios"
import { getViewId } from "./viewIds"
import { normalizeRunway } from "./oppositeRunways"
import { parseAwosHtml, parseRunwayInUse, normalizeMetarText } from "./parseAwos"
import { findSccForRunway, parseSccFromInfo, SccEntry } from "./parseScc"
import { assessFlightCategory, FlightCategory, WxAdaptation } from "./flightCategory"

const CACHE_TTL_MS = 60_000
const AWOS_BASE = "https://wx.awos.se/get.aspx"

interface CacheEntry {
    fetchedAt: number
    html: string
}

const cache: { [icao: string]: CacheEntry } = {}

export interface OpsResponse {
    icao: string
    observedAt: string | null
    runwayInUse: { arr: string | null; dep: string | null }
    flightCategory: FlightCategory
    wxAdaptation: WxAdaptation
    scc: SccEntry | null
    sccAll: SccEntry[]
    metar: string | null
}

async function fetchAwosHtml(icao: string): Promise<string> {
    const key = icao.toUpperCase()
    const viewId = getViewId(key)
    if (!viewId) throw Object.assign(new Error(`No AWOS viewId for ${key}`), { status: 404 })

    const cached = cache[key]
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.html
    }

    const url = `${AWOS_BASE}?viewId=${encodeURIComponent(viewId)}`
    const res = await axios.get(url, { timeout: 15000, responseType: "text" })
    const html = typeof res.data === "string" ? res.data : String(res.data)
    cache[key] = { fetchedAt: Date.now(), html }
    return html
}

export function buildOpsFromHtml(icao: string, html: string, runway?: string): OpsResponse {
    const parts = parseAwosHtml(html)
    const runwayInUse = parseRunwayInUse(parts.rwy)
    const metar = normalizeMetarText(parts.metar) || null
    const category = assessFlightCategory(metar || "")
    const sccAll = parseSccFromInfo(parts.info.replace(/<[^>]+>/g, ""))

    let scc: SccEntry | null = null
    if (runway) {
        scc = findSccForRunway(sccAll, runway) || null
        if (scc) {
            scc = { ...scc, runway: normalizeRunway(runway) }
        }
    }

    const observedAt = parts.time.replace(/<[^>]+>/g, "").trim() || null

    return {
        icao: icao.toUpperCase(),
        observedAt,
        runwayInUse,
        flightCategory: category.flightCategory,
        wxAdaptation: category.wxAdaptation,
        scc,
        sccAll,
        metar,
    }
}

export async function getOps(icao: string, runway?: string): Promise<OpsResponse> {
    const html = await fetchAwosHtml(icao)
    return buildOpsFromHtml(icao, html, runway)
}

/** Clear cache (tests). */
export function clearWxCache() {
    for (const k of Object.keys(cache)) delete cache[k]
}
