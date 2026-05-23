import type {
    AltitudeType,
    ExcludedRestriction,
    ParseWarning,
    Restriction,
    RestrictionJson,
    UsePlanMode,
} from "./types"
import { normalizeAreaId } from "./topsky-areas-loader"
import { looksLikeModernFormat, parseModernUsePlanText } from "./parser-modern"

const SWEDISH_MONTHS: Record<string, string> = {
    jan: "January",
    feb: "February",
    mar: "March",
    apr: "April",
    maj: "May",
    jun: "June",
    jul: "July",
    aug: "August",
    sep: "September",
    okt: "October",
    nov: "November",
    dec: "December",
}

function findTokenIndex(arr: string[], token: string): number {
    return arr.findIndex((t) => t === token)
}

function remapEsSup(arr: string[], line: string): string[] {
    const a = [...arr]
    if (!line.includes("ES SUP")) return a

    if (a[1]?.includes(":")) {
        if (line.includes("ft")) {
            a[0] = a[1]
            a[1] = a[2]
            a[2] = a[5]
            a[3] = a[10]
            a[4] = a[8]
            a[5] = a[9]
            a[6] = a[11]
        } else {
            a[0] = a[1]
            a[1] = a[2]
            a[2] = a[9]
            a[3] = a[11]
            a[4] = a[6]
            a[6] = a[8]
        }
    } else {
        if (line.includes("ft")) {
            a[0] = a[1]
            a[1] = a[2]
            a[2] = a[3]
            a[3] = a[4]
            a[4] = a[7]
            a[5] = a[12]
            a[7] = a[10]
            a[8] = a[11]
            delete a[11]
        } else {
            a[0] = a[1]
            a[1] = a[2]
            a[2] = a[6]
            a[3] = a[4]
            a[4] = a[6]
            a[6] = a[8]
        }
    }
    return Object.values(a).filter((v) => v !== undefined) as string[]
}

function parseDateWithSwedishMonth(day: string, shortMonth: string): Date {
    const monthName = SWEDISH_MONTHS[shortMonth.toLowerCase()]
    if (!monthName) {
        throw new Error(`Unknown month: ${shortMonth}`)
    }
    const now = new Date()
    let year = now.getUTCFullYear()
    const candidate = new Date(`${monthName} ${day}, ${year} 12:00:00 UTC`)
    const sixMonthsMs = 180 * 24 * 60 * 60 * 1000
    if (candidate.getTime() < now.getTime() - sixMonthsMs) {
        year += 1
    }
    return new Date(`${monthName} ${day}, ${year} 12:00:00 UTC`)
}

function utcToday(): Date {
    const n = new Date()
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

function setUtcTime(base: Date, hh: number, mm: number, ss = 0, ms = 0): Date {
    return new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hh, mm, ss, ms),
    )
}

function isTimeToken(token: string): boolean {
    return token.length > 2 && token[2] === ":"
}

function parseTimeOnToday(token: string): Date {
    const hh = parseInt(token.slice(0, 2), 10)
    const mm = parseInt(token.slice(3, 5), 10)
    return setUtcTime(utcToday(), hh, mm)
}

function parseLine(line: string, lineNum: number): { restriction?: Restriction; warning?: ParseWarning } {
    if (!line.includes("ES") && !line.includes("ES SUP")) {
        return {}
    }

    try {
        if (line.includes("ES SUP ") && line.includes("FL")) {
            line = line.replace("ES SUP ", "ES SUP")
        }

        let comment = ""
        if (line.startsWith("CIV ACFT") || line.startsWith("MIL ACFT")) {
            comment = "FLYG"
            line = line.trim().slice(8)
        } else if (line.startsWith("TT")) {
            comment = "FLYG"
            line = line.trim().slice(2)
        }

        line = line.replace(/\t/g, " ")
        let arr = line.split(" ").filter((p) => p.length > 0)
        arr = remapEsSup(arr, line)

        if (arr.length > 15) {
            return {}
        }

        const esIdx = findTokenIndex(arr, "ES")
        if (esIdx < 0) {
            return { warning: { line: lineNum, snippet: line.slice(0, 80), message: "ES token not found" } }
        }

        let name: string
        if (arr[esIdx + 1]?.includes("/")) {
            name = arr[esIdx] + arr[esIdx + 2]
        } else {
            name = arr[esIdx] + arr[esIdx + 1]
        }

        const ftIdx = findTokenIndex(arr, "ft")
        let altitudeType: AltitudeType
        let altitude: string
        if (ftIdx >= 0) {
            altitudeType = "ft"
            altitude = arr[ftIdx - 1]
            if (!altitude) {
                return { warning: { line: lineNum, snippet: line.slice(0, 80), message: "Missing ft altitude" } }
            }
        } else {
            const flIdx = findTokenIndex(arr, "FL")
            if (flIdx < 0) {
                return { warning: { line: lineNum, snippet: line.slice(0, 80), message: "Missing FL/ft" } }
            }
            altitudeType = "FL"
            altitude = arr[flIdx + 2]
            if (!altitude) {
                return { warning: { line: lineNum, snippet: line.slice(0, 80), message: "Missing FL value" } }
            }
        }

        let to: Date
        if (isTimeToken(arr[0])) {
            to = parseTimeOnToday(arr[0])
            arr = arr.slice(1)
        } else {
            to = parseDateWithSwedishMonth(arr[0], arr[1])
            to = setUtcTime(to, 23, 59, 59)
            arr = arr.slice(2)
        }

        let from: Date
        if (isTimeToken(arr[0])) {
            from = parseTimeOnToday(arr[0])
        } else {
            from = parseDateWithSwedishMonth(arr[0], arr[1])
            from = setUtcTime(from, 0, 0, 0)
        }

        return {
            restriction: {
                name: name.replace(/\s+/g, ""),
                from,
                to,
                altitude,
                altitudeType,
                comment,
            },
        }
    } catch (e: any) {
        return {
            warning: {
                line: lineNum,
                snippet: line.slice(0, 80),
                message: e?.message || "parse error",
            },
        }
    }
}

function parseLegacyUsePlanText(text: string): {
    restrictions: Restriction[]
    parseWarnings: ParseWarning[]
} {
    const restrictions: Restriction[] = []
    const parseWarnings: ParseWarning[] = []
    const lines = text.split(/\r?\n|\r\n?/)

    for (let i = 0; i < lines.length; i++) {
        const { restriction, warning } = parseLine(lines[i], i + 1)
        if (restriction) restrictions.push(restriction)
        if (warning) parseWarnings.push(warning)
    }

    return { restrictions, parseWarnings }
}

export function parseUsePlanText(text: string): {
    restrictions: Restriction[]
    parseWarnings: ParseWarning[]
} {
    if (looksLikeModernFormat(text)) {
        const modern = parseModernUsePlanText(text)
        if (modern.restrictions.length > 0) {
            return modern
        }
    }
    return parseLegacyUsePlanText(text)
}

export function formatYmd(d: Date): string {
    const y = d.getUTCFullYear() % 100
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${String(y).padStart(2, "0")}${m}${day}`
}

export function formatHi(d: Date): string {
    const h = String(d.getUTCHours()).padStart(2, "0")
    const m = String(d.getUTCMinutes()).padStart(2, "0")
    return `${h}${m}`
}

function aPrefixToFeet(a: string): string {
    return String(parseInt(a, 10) * 100)
}

function formatTopSkyAltitude(r: Restriction): string {
    if (r.altitudeType === "FL") {
        const lower = `${r.altitude}00`
        if (r.altitudeUpper) {
            return `${lower}:${r.altitudeUpper}00`
        }
        return `0:${lower}`
    }
    if (r.altitudeUpper) {
        if (r.altitude === "0") {
            return `0:${r.altitudeUpper}`
        }
        return `${aPrefixToFeet(r.altitude)}:${r.altitudeUpper}00`
    }
    return `0:${r.altitude}`
}

function formatTopSkyManualActLine(r: Restriction): string {
    let altPart: string
    if (r.altitudeType === "FL") {
        const fl = r.altitudeUpper || r.altitude
        altPart = `${fl}00:`
    } else {
        altPart = `${r.altitude}:`
    }
    let line = `${r.name}:${formatYmd(r.from)}:${formatYmd(r.to)}:0:${formatHi(r.from)}:${formatHi(r.to)}:0:${altPart}`
    if (r.comment) {
        line += r.comment
    }
    return line
}

export function serializeTopSky(restrictions: Restriction[]): string {
    const lines: string[] = ["REFRESH_INTERVAL:3600"]
    for (const r of restrictions) {
        let line = `${r.name}:${formatYmd(r.from)}:${formatYmd(r.to)}:0:${formatHi(r.from)}:${formatHi(r.to)}:${formatTopSkyAltitude(r)}`
        if (r.comment) {
            line += `:${r.comment}`
        }
        lines.push(line)
    }
    return lines.join("\n")
}

export function serializeTopSkyManualAct(restrictions: Restriction[]): string {
    const lines: string[] = []
    for (const r of restrictions) {
        lines.push(formatTopSkyManualActLine(r))
        lines.push(`${r.name}:MANUAL`)
    }
    return lines.join("\n")
}

export function filterRestrictions(
    restrictions: Restriction[],
    mode: UsePlanMode,
    knownIds: Set<string>,
    struckAreaIds: Set<string>,
): { included: Restriction[]; excluded: ExcludedRestriction[] } {
    const included: Restriction[] = []
    const excluded: ExcludedRestriction[] = []

    for (const r of restrictions) {
        const id = normalizeAreaId(r.name)
        if (struckAreaIds.has(id)) {
            excluded.push({ name: r.name, reason: "strikethrough" })
            continue
        }
        if (mode === "sectorfile" && !knownIds.has(id)) {
            excluded.push({ name: r.name, reason: "not_in_sectorfile" })
            continue
        }
        included.push(r)
    }

    return { included, excluded }
}

/** @deprecated Use filterRestrictions */
export function filterByMode(
    restrictions: Restriction[],
    mode: UsePlanMode,
    knownIds: Set<string>,
): { included: Restriction[]; excluded: ExcludedRestriction[] } {
    return filterRestrictions(restrictions, mode, knownIds, new Set())
}

export function restrictionToJson(r: Restriction): RestrictionJson {
    return {
        name: r.name,
        from: r.from.toISOString(),
        to: r.to.toISOString(),
        altitude: r.altitude,
        altitudeType: r.altitudeType,
        ...(r.altitudeUpper ? { altitudeUpper: r.altitudeUpper } : {}),
        comment: r.comment,
    }
}
