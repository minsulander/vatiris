import * as cheerio from "cheerio"

export interface AwosParts {
    time: string
    rwy: string
    metreport: string
    info: string
    metsensor: string
    metar: string
}

export interface RunwayInUse {
    arr: string | null
    dep: string | null
}

/** Split AWOS HTML fragment into spanText parts (document order). */
export function parseAwosHtml(html: string): AwosParts {
    const $ = cheerio.load(html)
    const parts: string[] = []
    $(".spanText").each((_, el) => {
        parts.push($(el).html()?.trim() || $(el).text().trim() || "")
    })
    return {
        time: parts[0] || "",
        rwy: parts[1] || "",
        metreport: parts[2] || "",
        info: parts[3] || "",
        metsensor: parts[4] || "",
        metar: parts[5] || "",
    }
}

/** Parse "RUNWAY IN USE: <b>ARR: 01L DEP: 01L</b>" style text. */
export function parseRunwayInUse(rwyHtml: string): RunwayInUse {
    const text = rwyHtml
        .replace(/<[^>]+>/g, "")
        .replace(/RUNWAY IN USE:\s*/i, "")
        .trim()
    const m = text.match(/ARR:\s*(\S+)\s+DEP:\s*(\S+)/i)
    if (m) {
        return { arr: m[1].toUpperCase(), dep: m[2].toUpperCase() }
    }
    return { arr: null, dep: null }
}

/** Strip METAR prefix label if present. */
export function normalizeMetarText(metarPart: string): string {
    const text = metarPart.replace(/<[^>]+>/g, "").trim()
    return text
}
