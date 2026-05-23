import type { AltitudeType, ParseWarning, Restriction } from "./types"

export const SWEDISH_MONTHS: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    maj: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    okt: 9,
    nov: 10,
    dec: 11,
}

/** Four time fields: day + startHH + startMM + endHH + endMM */
const GLUED_FULL_RE =
    /^((?:CIV ACFT|MIL ACFT|ACFT|TT)|(?:UAV\/UAS[^\d]*))?(\d{1,2}):(\d{2})(\d{2}):(\d{2})(\d{2})((?:ES\s*SUP|ES)\s*.+)$/i

/** LFV PDF often omits colons: day + endHHMM fragment + endMM, start 00:00 UTC — e.g. 20:0017:00 → 20th, 00:00–17:00 */
const GLUED_SHORT_RE =
    /^((?:CIV ACFT|MIL ACFT|ACFT|TT)|(?:UAV\/UAS[^\d]*))?(\d{1,2}):(\d{3,4}):(\d{2})((?:ES\s*SUP|ES)\s*.+)$/i

/** Cross-month: ACFT24 maj18 majES R22A */
const MAJ_LINE_RE =
    /^(?:(?:CIV ACFT|MIL ACFT|ACFT|TT)\s*)?(\d{1,2})\s*maj\s*(\d{1,2})\s*maj\s*((?:ES\s*SUP|ES)\s*.+)$/i

const ALT_FT_RE = /^(\d+)\s*ft$/i
const ALT_FL_RE = /^FL\s*(\d+)/i

export function extractPlanDateUtc(text: string): { year: number; month: number; day: number } | null {
    const m = text.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) - 1, day: parseInt(m[3], 10) }
}

function commentFromLine(line: string): string {
    if (/^CIV ACFT|^MIL ACFT|^ACFT/i.test(line)) return "FLYG"
    if (/^TT/i.test(line)) return "FLYG"
    return ""
}

function parseAreaToken(raw: string): string {
    const cleaned = raw.trim()
    if (/^ES\s*SUP/i.test(cleaned)) {
        return cleaned.replace(/\s+/g, "")
    }
    return cleaned.replace(/\s+/g, "")
}

function utcDateTime(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
): Date {
    return new Date(Date.UTC(year, month, day, hour, minute, 0, 0))
}

function parseAltitudeLine(line: string): { altitude: string; altitudeType: AltitudeType } | null {
    const ft = line.match(ALT_FT_RE)
    if (ft) return { altitude: ft[1], altitudeType: "ft" }
    const fl = line.match(ALT_FL_RE)
    if (fl) return { altitude: fl[1], altitudeType: "FL" }
    return null
}

function buildRestriction(
    name: string,
    from: Date,
    to: Date,
    altitude: string,
    altitudeType: AltitudeType,
    comment: string,
): Restriction {
    return { name, from, to, altitude, altitudeType, comment }
}

function parseGluedLine(
    line: string,
    plan: { year: number; month: number; day: number },
): Restriction | null {
    const short = line.match(GLUED_SHORT_RE)
    if (short) {
        const day = parseInt(short[2], 10)
        const endDigits = `${short[3]}${short[4]}`.padStart(4, "0").slice(-4)
        const eh = parseInt(endDigits.slice(0, 2), 10)
        const em = parseInt(endDigits.slice(2, 4), 10)
        if (eh > 23 || em > 59) return null

        const name = parseAreaToken(short[5])
        const from = utcDateTime(plan.year, plan.month, day, 0, 0)
        let to = utcDateTime(plan.year, plan.month, day, eh, em)
        if (to.getTime() <= from.getTime()) {
            to = new Date(to.getTime() + 24 * 60 * 60 * 1000)
        }
        return buildRestriction(name, from, to, "", "ft", commentFromLine(line))
    }

    const full = line.match(GLUED_FULL_RE)
    if (full) {
        const day = parseInt(full[2], 10)
        const sh = parseInt(full[3], 10)
        const sm = parseInt(full[4], 10)
        const eh = parseInt(full[5], 10)
        const em = parseInt(full[6], 10)
        if (sh > 23 || sm > 59 || eh > 23 || em > 59) return null
        const name = parseAreaToken(full[7])
        const from = utcDateTime(plan.year, plan.month, day, sh, sm)
        let to = utcDateTime(plan.year, plan.month, day, eh, em)
        if (to.getTime() <= from.getTime()) {
            to = new Date(to.getTime() + 24 * 60 * 60 * 1000)
        }
        return buildRestriction(name, from, to, "", "ft", commentFromLine(line))
    }

    return null
}

function parseMajLine(
    line: string,
    plan: { year: number; month: number; day: number },
): Restriction | null {
    const m = line.match(MAJ_LINE_RE)
    if (!m) return null

    const fromDay = parseInt(m[1], 10)
    const toDay = parseInt(m[2], 10)
    const name = parseAreaToken(m[3])
    const fromMonth = 4 // maj = May
    let toMonth = fromMonth
    if (toDay < fromDay) {
        // e.g. 24 maj – 18 jun (PDF often prints "maj" twice); roll end into June
        toMonth = fromMonth + 1
    }
    const from = utcDateTime(plan.year, fromMonth, fromDay, 0, 0)
    const to = utcDateTime(plan.year, toMonth, toDay, 23, 59)
    return buildRestriction(name, from, to, "", "ft", commentFromLine(line))
}

export function parseModernUsePlanText(text: string): {
    restrictions: Restriction[]
    parseWarnings: ParseWarning[]
} {
    const restrictions: Restriction[] = []
    const parseWarnings: ParseWarning[] = []
    const planDate = extractPlanDateUtc(text)
    if (!planDate) {
        return {
            restrictions: [],
            parseWarnings: [{ message: "Could not find plan date (YYYY-MM-DD) in PDF text" }],
        }
    }

    const lines = text.split(/\r?\n|\r\n?/).map((l) => l.trim()).filter(Boolean)

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!/ES/i.test(line)) continue

        let rest =
            parseGluedLine(line, planDate) ||
            parseMajLine(line, planDate)

        if (!rest) continue

        const next = lines[i + 1]
        const alt = next ? parseAltitudeLine(next) : null
        if (alt) {
            rest.altitude = alt.altitude
            rest.altitudeType = alt.altitudeType
            i++
        } else if (rest.altitude === "") {
            parseWarnings.push({
                line: i + 1,
                snippet: line.slice(0, 80),
                message: "No altitude line following area row",
            })
            continue
        }

        restrictions.push(rest)
    }

    return { restrictions, parseWarnings }
}

export function looksLikeModernFormat(text: string): boolean {
    return (
        /\d{1,2}:\d{2}\d{2}:\d{2}\d{2}(?:ES\s*SUP|ES)/i.test(text) ||
        /\d{1,2}:\d{3,4}:\d{2}(?:ES\s*SUP|ES)/i.test(text)
    )
}
