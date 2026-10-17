/**
 * IMC/VMC minima for IRIS weather-ops (tunable without EFS changes).
 * IMC if visibility < 5000 m or ceiling/VV < 1500 ft; CAVOK → VMC.
 */
export const VIS_IMC_BELOW_M = 5000
export const CEILING_IMC_BELOW_FT = 1500

export type FlightCategory = "VMC" | "IMC"

export interface WxAdaptation {
    label: FlightCategory
    cavok: boolean
    lowVisibility: boolean
    rvrRelevant: boolean
    ceilingFt: number | null
    visibilityM: number | null
}

export interface FlightCategoryResult {
    flightCategory: FlightCategory
    wxAdaptation: WxAdaptation
}

/** Extract ceiling (BKN/OVC lowest) or vertical visibility from METAR body. */
export function parseCeilingFt(metar: string): number | null {
    if (!metar) return null
    if (/\bCAVOK\b/.test(metar) || /\bNSC\b/.test(metar) || /\bNCD\b/.test(metar) || /\bSKC\b/.test(metar)) {
        return null
    }
    const vv = metar.match(/\bVV(\d{3})\b/)
    if (vv) return parseInt(vv[1], 10) * 100

    let lowest: number | null = null
    const cloudRe = /\b(?:FEW|SCT|BKN|OVC)(\d{3})\b/g
    let m: RegExpExecArray | null
    while ((m = cloudRe.exec(metar)) !== null) {
        const base = parseInt(m[1], 10) * 100
        const type = m[0].slice(0, 3)
        if (type === "BKN" || type === "OVC") {
            if (lowest === null || base < lowest) lowest = base
        }
    }
    return lowest
}

/** Parse visibility in metres from METAR (9999 → 9999, CAVOK → 9999). */
export function parseVisibilityM(metar: string): number | null {
    if (!metar) return null
    if (/\bCAVOK\b/.test(metar)) return 9999
    // Statute miles patterns skipped for Swedish METAR
    const vis4 = metar.match(/\b(\d{4})\b/)
    if (vis4) {
        // Avoid matching wind 29004KT — visibility is typically after wind group
        const afterWind = metar.match(
            /\d{3}\d{2}(?:G\d{2})?KT\s+(?:(\d{4})|CAVOK|\/\/\/\/)/,
        )
        if (afterWind && afterWind[1]) return parseInt(afterWind[1], 10)
        if (/\bCAVOK\b/.test(metar)) return 9999
    }
    const afterKt = metar.match(/KT\s+(\d{4})\b/)
    if (afterKt) return parseInt(afterKt[1], 10)
    return null
}

export function assessFlightCategory(metar: string): FlightCategoryResult {
    const cavok = /\bCAVOK\b/.test(metar || "")
    const visibilityM = parseVisibilityM(metar || "")
    const ceilingFt = parseCeilingFt(metar || "")

    const lowVis =
        visibilityM !== null && visibilityM < VIS_IMC_BELOW_M && !cavok
    const lowCeiling =
        ceilingFt !== null && ceilingFt < CEILING_IMC_BELOW_FT

    const imc = !cavok && (lowVis || lowCeiling)
    const flightCategory: FlightCategory = imc ? "IMC" : "VMC"

    const rvrRelevant =
        visibilityM !== null && visibilityM < 1500 && !cavok

    return {
        flightCategory,
        wxAdaptation: {
            label: flightCategory,
            cavok,
            lowVisibility: lowVis || rvrRelevant,
            rvrRelevant,
            ceilingFt,
            visibilityM,
        },
    }
}
