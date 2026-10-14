/**
 * SID display formatting — mirrored from vatefs `common/src/sid-format.ts`
 * (`formatSidForDisplay` and its helpers).
 *
 * - RNAV: "PETEV3G" → "PETEV 3G" (paper/compact: "PETEV3G")
 * - VFR:  "VFR·NORTH" → "NORTH"
 * - Radar-vector: "ARS6E·KOGAV" → "ARS 6E veKOGAV"
 * - SLOW track: "120·BABAP" → "120veBABAP"; "010·240·NOSLI" → "010·240veNOSLI"
 */

const TRACK_SEP_RE = /[·•*]/

/** Real SLOW/track SIDs: NNN·EXIT or NNN·NNN·EXIT (not namedSID·EXIT). */
const TRACK_SID_RE = /^\d{3}([·•*]\d{3})?[·•*][A-Z]{2,}$/i

/** RNAV spacing for a compact designator: ARS6E → ARS 6E (or ARS6E when compact). */
function formatNamedSidBase(base: string, compact = false): string {
    const m = base.match(/^([A-Za-z]{2,})(\d+[A-Za-z]+)$/)
    if (!m) return base.toUpperCase()
    const name = m[1]!.toUpperCase()
    const desig = m[2]!.toUpperCase()
    return compact ? `${name}${desig}` : `${name} ${desig}`
}

/**
 * Radar-vector SID: named procedure · TMA exit (e.g. ARS6E·KOGAV).
 */
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

/** True for heading/track SLOW SIDs only (NNN·EXIT / NNN·NNN·EXIT). */
export function isTrackSidName(sid: string | undefined | null): boolean {
    if (!sid) return false
    const raw = sid.trim().toUpperCase().replace(/\s+/g, "")
    if (!raw || raw.startsWith("VFR")) return false
    if (isVectorSidName(raw)) return false
    return TRACK_SID_RE.test(raw)
}

/** Strip display form for ESE track/SLOW SIDs. */
export function formatTrackSidDisplay(sid: string | undefined | null): string | null {
    if (!sid) return null
    const raw = sid.trim().toUpperCase().replace(/\s+/g, "")
    if (!raw || /^VFR/i.test(raw)) return null
    if (isVectorSidName(raw)) return null
    if (!TRACK_SEP_RE.test(raw)) return null

    const parts = raw.split(TRACK_SEP_RE).filter(Boolean)
    if (parts.length === 3) {
        const [a, b, exit] = parts
        if (/^\d{3}$/.test(a!) && /^\d{3}$/.test(b!) && /^[A-Z]{2,}$/.test(exit!)) {
            return `${a!}·${b!}ve${exit!}`
        }
        return null
    }
    if (parts.length === 2) {
        const [heading, exit] = parts
        if (/^\d{3}$/.test(heading!) && /^[A-Z]{2,}$/.test(exit!)) {
            return `${heading!}ve${exit!}`
        }
    }
    return null
}

/** Display for radar-vector SIDs: "ARS 6E veKOGAV" (or compact). */
export function formatVectorSidDisplay(
    sid: string | undefined | null,
    tmaExit?: string | null,
    compact = false,
): string | null {
    const parsed = parseVectorSidName(sid)
    if (!parsed) return null
    const exit = (tmaExit || "").trim().toUpperCase() || parsed.exit
    return `${formatNamedSidBase(parsed.base, compact)} ve${exit}`
}

/**
 * @param compact — paper/ESGG: no space between SID name and designator (PETEV2G).
 */
export function formatSidForDisplay(
    sid: string | undefined | null,
    tmaExit?: string | null,
    compact = false,
): string {
    if (!sid) return ""
    const s = sid.trim()
    if (!s) return ""

    // VFR·NAME / VFR.NAME / VFR NAME → NAME
    if (/^VFR/i.test(s)) {
        const rest = s.replace(/^VFR\s*[·.•.]?\s*/i, "").trim()
        return rest || s
    }

    const vector = formatVectorSidDisplay(s, tmaExit, compact)
    if (vector) return vector

    const track = formatTrackSidDisplay(s)
    if (track) return track

    // Already spaced (e.g. "PETEV 2G") — collapse for paper/ESGG
    if (/\s/.test(s)) {
        if (compact) {
            const spaced = s
                .replace(/\s+/g, " ")
                .trim()
                .match(/^([A-Za-z]{2,})\s+(\d+[A-Za-z]+)$/i)
            if (spaced) return `${spaced[1]!.toUpperCase()}${spaced[2]!.toUpperCase()}`
        }
        return s
    }
    // EXIT + designator (digits + letter), e.g. PETEV3G, ARS5C, ROKNI3R
    const m = s.match(/^([A-Za-z]{2,})(\d+[A-Za-z]+)$/)
    if (!m) return s
    const name = m[1]!.toUpperCase()
    const desig = m[2]!.toUpperCase()
    return compact ? `${name}${desig}` : `${name} ${desig}`
}
