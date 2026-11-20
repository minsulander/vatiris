/**
 * ENGINE ICE on military MET REPORTs.
 *
 * YES when the temperature is below +10°C and relative humidity is at least
 * 80%. Humidity is computed from temperature and dewpoint (Magnus formula).
 * At +10°C and above the result is NO. Clouds and visibility are not used.
 */

/** Relative humidity at or above this, with temperature below +10°C, is ENGINE ICE. */
export const ENGINE_ICE_MIN_RH = 80

/** Swedish military aerodromes. Joint civil/military fields with mil ATC are included. */
export const militaryAirports = [
    "ESCF", // Malmen
    "ESCM", // Uppsala
    "ESDF", // Ronneby, F 17
    "ESFR", // Råda
    "ESIA", // Karlsborg
    "ESIB", // Såtenäs
    "ESMV", // Hagshult
    "ESPA", // Luleå, F 21
    "ESPE", // Vidsel
    "ESSV", // Visby
]

const MAGNUS_A = 17.625
const MAGNUS_B = 243.04

function saturationFactor(tempC: number): number {
    return Math.exp((MAGNUS_A * tempC) / (MAGNUS_B + tempC))
}

/** Relative humidity in percent. Dewpoint above temperature is treated as saturated. */
export function relativeHumidity(tempC: number, dewpointC: number): number {
    const dew = Math.min(dewpointC, tempC)
    const rh = (100 * saturationFactor(dew)) / saturationFactor(tempC)
    if (!Number.isFinite(rh)) return 0
    return Math.min(100, Math.max(0, rh))
}

/** 80 when temperature is below +10°C, otherwise no engine-ice assessment applies. */
export function minimumEngineIceRh(tempC: number): number | undefined {
    if (tempC >= 10) return undefined
    return ENGINE_ICE_MIN_RH
}

export function hasEngineIceRisk(tempC: number, dewpointC: number): boolean {
    if (tempC >= 10) return false
    return relativeHumidity(tempC, dewpointC) >= ENGINE_ICE_MIN_RH
}

export function stripEngineIce(report: string): string {
    return report
        .replace(/\r?\n[ \t]*ENGINE ICE: (?:YES|NO)[ \t]*/g, "")
        .replace(/^[ \t]*ENGINE ICE: (?:YES|NO)[ \t]*\r?\n?/m, "")
}

function parseTempDewpoint(report: string): { temp: number; dew: number } | undefined {
    const plain = report.replace(/<[^>]+>/g, " ")
    const m = plain.match(/T\s*(MS|M)?\s*(\d{1,2})\s+DP\s*(MS|M)?\s*(\d{1,2})/i)
    if (!m) return undefined
    const sign = (prefix?: string) => (prefix ? -1 : 1)
    return {
        temp: parseInt(m[2], 10) * sign(m[1]),
        dew: parseInt(m[4], 10) * sign(m[3]),
    }
}

/** Append ENGINE ICE after the QNH line. Civilian reports are unchanged. */
export function insertEngineIce(icao: string, report: string): string {
    if (!report || !militaryAirports.includes(icao.toUpperCase())) return report
    const stripped = stripEngineIce(report)
    const td = parseTempDewpoint(stripped)
    if (!td) return stripped
    const line = `ENGINE ICE: ${hasEngineIceRisk(td.temp, td.dew) ? "YES" : "NO"}`
    if (/^QNH\b/m.test(stripped)) {
        return stripped.replace(/^QNH\b.*$/m, (qnh) => {
            // Digits use margin-top: 7px, which is the gap under T/DP.
            // The next line's glyphs sit 1px inside a bottom margin, so 8px
            // below the digits is the same 7px gap above ENGINE ICE.
            let spaced = qnh
            if (spaced.includes("margin-bottom")) {
                spaced = spaced.replace("margin-bottom: 7px", "margin-bottom: 8px")
            } else {
                spaced = spaced.replace(
                    "margin-top: 7px",
                    "margin-top: 7px; margin-bottom: 8px",
                )
            }
            return `${spaced}\n${line}`
        })
    }
    return `${stripped.replace(/\s*$/, "")}\n${line}`
}
