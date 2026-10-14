/**
 * CFL strip display — mirrored from vatefs `formatStripAltitude` + `displayCflForStrip`.
 *
 * ≤ TA (5000) → thousands with one decimal ("5.0")
 * > TA        → FL number without prefix ("90")
 * ES 1 / 2    → CA / VA
 * Hidden when blank, or CFL equals RFL before clearance, or CFL equals XFL.
 */

export const DEFAULT_TRANSITION_ALTITUDE_FT = 5000

function isApproachClearanceLabel(input: string | null | undefined): boolean {
    if (input == null || input === "") return false
    const s = String(input).trim().toUpperCase()
    if (s === "CA" || s === "VA" || s === "OS") return true
    if (/^CAT\d$/.test(s)) return true
    if (!/^[A-Z][A-Z0-9]{0,3}$/.test(s)) return false
    if (/^A\d{1,3}$/.test(s) || /^FL\d{2,3}$/.test(s)) return false
    return true
}

export function parseAltitudeToFeet(input: string | number | null | undefined): number | undefined {
    if (input == null || input === "") return undefined
    if (typeof input === "number") {
        if (!Number.isFinite(input) || input <= 0) return undefined
        if (input === 1 || input === 2) return undefined
        if (input > 0 && input < 1000 && Number.isInteger(input)) return input * 100
        return input
    }

    const s = String(input).trim().toUpperCase().replace(/\s+/g, "")
    if (!s) return undefined
    if (isApproachClearanceLabel(s)) return undefined

    if (/^\d+\.\d$/.test(s)) {
        const thou = parseFloat(s)
        if (!Number.isFinite(thou) || thou <= 0) return undefined
        return Math.round(thou * 1000)
    }

    const fl = s.match(/^F(?:L)?(\d{2,3})$/)
    if (fl) return parseInt(fl[1]!, 10) * 100

    const alt = s.match(/^A(\d{2,3})$/)
    if (alt) return parseInt(alt[1]!, 10) * 100

    const n = parseInt(s, 10)
    if (!Number.isFinite(n) || n <= 0) return undefined
    if (n < 1000) return n * 100
    return n
}

export function formatStripAltitude(
    input: string | number | null | undefined,
    transitionAltitudeFt: number = DEFAULT_TRANSITION_ALTITUDE_FT,
): string | undefined {
    if (input == null || input === "") return undefined
    if (typeof input === "string" && isApproachClearanceLabel(input)) {
        return input.trim().toUpperCase()
    }
    if (input === 1 || input === "1") return "CA"
    if (input === 2 || input === "2") return "VA"

    const feet = parseAltitudeToFeet(input)
    if (feet == null) return undefined

    if (feet <= transitionAltitudeFt) {
        return (feet / 1000).toFixed(1)
    }
    return String(Math.round(feet / 100))
}

export interface DisplayCflInput {
    /** EuroScope temporary altitude / EFS clearedAltitude */
    cfl?: string | number | null
    rfl?: string | number | null
    xfl?: string | number | null
    cleared?: boolean
}

/**
 * Same visibility rules as vatefs `displayCflForStrip`:
 * real assigned CFL only; hide when equal to RFL (uncleared) or XFL.
 */
export function displayCflForStrip(input: DisplayCflInput): string {
    const cfl = input.cfl
    if (cfl == null || cfl === "" || cfl === 0 || cfl === "0") return ""

    // hasRealAssignedCfl: ignore RFL echo before clearance
    if (!input.cleared && input.rfl != null && input.rfl !== "" && String(cfl) === String(input.rfl)) {
        return ""
    }

    const formatted = formatStripAltitude(cfl) ?? ""
    if (!formatted) return ""

    if (input.xfl != null && input.xfl !== "" && input.xfl !== 0) {
        const xflFormatted = formatStripAltitude(input.xfl) ?? ""
        if (xflFormatted && formatted === xflFormatted) return ""
        const cflFeet = parseAltitudeToFeet(cfl)
        const xflFeet = parseAltitudeToFeet(input.xfl)
        if (cflFeet != null && xflFeet != null && cflFeet === xflFeet) return ""
    }

    return formatted
}
