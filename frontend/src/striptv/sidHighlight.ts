/**
 * SID highlight rules mirrored from vatefs FlightStrip + airport-rules:
 * 1) Amber — uncleared / VFR / radar-vector / SLOW track
 * 2) Black box — preferred next sector DEP-E or ARR-E (ESSA east SIDs)
 */

const TRACK_SEP_RE = /[·•*]/
const TRACK_SID_RE = /^\d{3}([·•*]\d{3})?[·•*][A-Z]{2,}$/i

/** DEP-E exits from vatefs `data/essa-sid-prefs.json` (Appendix A). */
const ESSA_DEP_E_EXITS = new Set(["TOVRI", "BABAP"])

export function parseVectorSidName(
    sid: string | undefined | null,
): { base: string; exit: string } | null {
    if (!sid) return null
    const raw = sid.trim().toUpperCase().replace(/\s+/g, "")
    if (!raw || /^VFR/i.test(raw)) return null
    if (!TRACK_SEP_RE.test(raw)) return null
    const parts = raw.split(TRACK_SEP_RE).filter(Boolean)
    if (parts.length !== 2) return null
    const [base, exit] = parts
    if (!base || !exit) return null
    if (!/^[A-Z]{2,}\d+[A-Z]+$/.test(base)) return null
    if (!/^[A-Z]{2,5}$/.test(exit) || exit.length === 4) return null
    return { base, exit }
}

export function isVectorSidName(sid: string | undefined | null): boolean {
    return parseVectorSidName(sid) !== null
}

export function isTrackSidName(sid: string | undefined | null): boolean {
    if (!sid) return false
    const raw = sid.trim().toUpperCase().replace(/\s+/g, "")
    if (!raw || raw.startsWith("VFR")) return false
    if (isVectorSidName(raw)) return false
    return TRACK_SID_RE.test(raw)
}

/** Extract TMA exit designator from SID (TOVRI5C → TOVRI, 240·BABAP → BABAP). */
export function extractSidExit(sid: string | undefined | null): string | null {
    if (!sid) return null
    const raw = sid.trim().toUpperCase().replace(/\s+/g, "")
    if (!raw) return null
    const vec = parseVectorSidName(raw)
    if (vec) return vec.exit
    if (TRACK_SEP_RE.test(raw)) {
        const last = raw.split(TRACK_SEP_RE).filter(Boolean).pop()
        if (last && /^[A-Z]{2,5}$/.test(last)) return last
    }
    const m = raw.match(/^([A-Z]{2,})(\d+[A-Z]+)$/)
    if (m) return m[1]!
    // Display form "TOVRI 5C" / "120veBABAP"
    const spaced = sid.trim().toUpperCase().match(/^([A-Z]{2,})\s+\d/)
    if (spaced) return spaced[1]!
    const ve = raw.match(/(?:VE|·)([A-Z]{2,5})$/)
    if (ve) return ve[1]!
    return null
}

/**
 * Amber SID (vatefs `sidHighlight`):
 * - no clearance yet
 * - VFR / VFR… SID
 * - radar-vector or SLOW track SID
 */
export function isSidAmberHighlight(options: {
    sid: string | undefined | null
    flightRules?: string | null
    /** EuroScope / esdata clearance flag; false/undefined = uncleared */
    cleared?: boolean | null
}): boolean {
    const raw = (options.sid || "").trim()
    if (!raw || raw === "—") return false
    if (!options.cleared) return true
    const fr = (options.flightRules || "").toUpperCase()
    if (fr.startsWith("V") || /^VFR/i.test(raw)) return true
    if (isVectorSidName(raw) || /[A-Z]{2,}\s+\d+[A-Z]+\s+ve[A-Z]{2,}/i.test(raw)) return true
    if (isTrackSidName(raw)) return true
    if (/\d{3}(·\d{3})?ve[A-Z]{2,}/i.test(raw.replace(/\s+/g, ""))) return true
    return false
}

/** Black SID box when preferred sector is DEP-E / ARR-E (vatefs `needsEssaEastSidBox`). */
export function needsEssaEastSidBox(
    appDepNextSector: string | null | undefined,
): boolean {
    const s = (appDepNextSector || "").trim().toUpperCase()
    return s === "DEP-E" || s === "ARR-E"
}

/**
 * Resolve east SID box for Strip TV:
 * 1) explicit sector from esdata/EFS when present
 * 2) SID exit in DEP-E set (TOVRI, BABAP)
 * 3) legacy: 19R + TOVRI/BABAP
 */
export function isEssaEastSidBox(options: {
    sid: string | undefined | null
    depRwy?: string | null
    appDepNextSector?: string | null
    adep?: string | null
}): boolean {
    if (options.appDepNextSector) {
        return needsEssaEastSidBox(options.appDepNextSector)
    }
    const adep = (options.adep || "ESSA").toUpperCase()
    if (adep !== "ESSA") return false
    const exit = extractSidExit(options.sid)
    if (exit && ESSA_DEP_E_EXITS.has(exit)) return true
    const rwy = (options.depRwy || "").toUpperCase().replace(/[^0-9LRC]/g, "")
    if (rwy === "19R" && exit && ESSA_DEP_E_EXITS.has(exit)) return true
    return false
}
