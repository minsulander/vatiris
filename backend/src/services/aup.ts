/**
 * LFV AUP Service - fetches and parses the Daily Use Plan PDF from LFV AIS.
 * Source: https://aro.lfv.se/Editorial/View/GeneralDocument?torLinkId=337&type=AIS&folderId=77
 */
import * as cheerio from "cheerio"
import axios from "axios"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>

const LFV_BASE_URL = process.env.LFV_BASE_URL || "https://aro.lfv.se"
const LFV_DAILY_USE_URL =
    process.env.LFV_AIS_DAILY_USE_URL || "/Editorial/View/GeneralDocument?torLinkId=337&type=AIS&folderId=77"
const AUP_CACHE_TTL_MS = (parseInt(process.env.AUP_CACHE_TTL_MINUTES || "60", 10) || 60) * 60 * 1000

const SWEDISH_MONTHS: Record<string, number> = {
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

export interface Restriction {
    name: string
    from: Date
    to: Date
    altitude: string
    altitudeType: "FL" | "ft"
    comment: string
}

export interface AupResult {
    restrictions: Restriction[]
    pdfDate: string | null
    fetchedAt: number
}

let cache: AupResult | null = null

function todayUTC(): string {
    const d = new Date()
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}

function parseDateFromLinkText(text: string): string | null {
    const match = text.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
    return null
}

async function getPdfUrlForToday(): Promise<{ url: string; date: string | null }> {
    const pageUrl = LFV_BASE_URL + LFV_DAILY_USE_URL
    const { data: html } = await axios.get(pageUrl, { timeout: 15000 })
    const $ = cheerio.load(html)

    const links: { href: string; date: string | null }[] = []
    $("a.document-link").each((_, el) => {
        const href = $(el).attr("href")
        const text = $(el).text().trim()
        if (!href) return
        const date = parseDateFromLinkText(text) || parseDateFromLinkText(href)
        links.push({ href: href.startsWith("http") ? href : LFV_BASE_URL + href, date })
    })

    const today = todayUTC()
    const forToday = links.find((l) => l.date === today)
    if (forToday) return { url: forToday.href, date: forToday.date }

    const sorted = links.filter((l) => l.date).sort((a, b) => (b.date! > a.date! ? 1 : -1))
    const latest = sorted[0]
    if (latest) return { url: latest.href, date: latest.date }

    if (links.length > 0) return { url: links[links.length - 1].href, date: null }
    throw new Error("No PDF links found on LFV Daily Use page")
}

function parseRestrictions(text: string): Restriction[] {
    const restrictions: Restriction[] = []
    const now = new Date()
    const y = now.getUTCFullYear()

    // LFV PDF extracts in column order: "toTimefromTimeES CODE" then "altitude" then "name" on separate lines
    // Match: (HH:MM)(HH:MM)ES CODE  or  (dd mmm)(dd mmm)...ES CODE
    const flat = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const lines = flat.split("\n").map((l) => l.trim()).filter(Boolean)

    let i = 0
    while (i < lines.length) {
        const line = lines[i]
        const timeTimeEs = line.match(/(\d{2}:\d{2})(\d{2}:\d{2})ES\s+([A-Z0-9]+[A-Za-z0-9/]*)/)
        const dateDateEs = line.match(/(\d{1,2})\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)\s*(\d{1,2})\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec).*?ES\s+([A-Z0-9]+[A-Za-z0-9/]*)/i)
        // ES SUP format: NOTAM ref + area code (D###, R###) e.g. "ES SUP 299/25D309" or "ES SUP 16/26R384"
        const esSupMatch = line.match(/ES\s+SUP\s+\d+\/\d+\s*([DR]\d+[A-Za-z]*)/i)
        if (esSupMatch) {
            const code = esSupMatch[1]
            if (dateDateEs) {
                const [, fromDay, fromMon, toDay, toMon] = dateDateEs
                const fromM = SWEDISH_MONTHS[fromMon.toLowerCase().slice(0, 3)] ?? 0
                const toM = SWEDISH_MONTHS[toMon.toLowerCase().slice(0, 3)] ?? 0
                const from = new Date(Date.UTC(y, fromM, parseInt(fromDay, 10), 0, 0))
                const to = new Date(Date.UTC(y, toM, parseInt(toDay, 10), 23, 59))
                let altitude = "0"
                let altitudeType: "FL" | "ft" = "ft"
                for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                    const ftMatch = lines[j].match(/^(\d+)\s*ft$/i)
                    const flMatch = lines[j].match(/FL\s*(\d+)/i)
                    if (ftMatch) {
                        altitude = ftMatch[1]
                        altitudeType = "ft"
                        break
                    }
                    if (flMatch) {
                        altitude = flMatch[1]
                        altitudeType = "FL"
                        break
                    }
                }
                const comment = line.includes("ACFT") ? "FLYG" : ""
                restrictions.push({ name: code, from, to, altitude, altitudeType, comment })
            }
            i++
            continue
        }
        if (timeTimeEs && timeTimeEs[3] === "SUP") {
            i++
            continue
        }
        if (dateDateEs && dateDateEs[5] === "SUP") {
            const areaCodeMatch = line.match(/([DR]\d+[A-Za-z]*)/i)
            const nextLines = lines.slice(i, i + 4).join(" ")
            const fallbackCode = nextLines.match(/([DR]\d+[A-Za-z]*)/i)
            const code = areaCodeMatch?.[1] || fallbackCode?.[1]
            if (code) {
                const [, fromDay, fromMon, toDay, toMon] = dateDateEs
                const fromM = SWEDISH_MONTHS[fromMon.toLowerCase().slice(0, 3)] ?? 0
                const toM = SWEDISH_MONTHS[toMon.toLowerCase().slice(0, 3)] ?? 0
                const from = new Date(Date.UTC(y, fromM, parseInt(fromDay, 10), 0, 0))
                const to = new Date(Date.UTC(y, toM, parseInt(toDay, 10), 23, 59))
                let altitude = "0"
                let altitudeType: "FL" | "ft" = "ft"
                for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                    const ftMatch = lines[j].match(/^(\d+)\s*ft$/i)
                    const flMatch = lines[j].match(/FL\s*(\d+)/i)
                    if (ftMatch) {
                        altitude = ftMatch[1]
                        altitudeType = "ft"
                        break
                    }
                    if (flMatch) {
                        altitude = flMatch[1]
                        altitudeType = "FL"
                        break
                    }
                }
                const comment = line.includes("ACFT") || nextLines.includes("ACFT") ? "FLYG" : ""
                restrictions.push({ name: code, from, to, altitude, altitudeType, comment })
            }
            i++
            continue
        }

        let from: Date
        let to: Date
        let name: string
        let altitude = "0"
        let altitudeType: "FL" | "ft" = "ft"
        let comment = ""

        if (timeTimeEs) {
            const [, toStr, fromStr, code] = timeTimeEs
            name = "ES " + code
            const fromH = parseInt(fromStr.slice(0, 2), 10)
            const fromM = parseInt(fromStr.slice(3, 5), 10)
            const toH = parseInt(toStr.slice(0, 2), 10)
            const toM = parseInt(toStr.slice(3, 5), 10)
            from = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate(), fromH, fromM))
            to = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate(), toH, toM))
        } else if (dateDateEs) {
            const [, fromDay, fromMon, toDay, toMon, code] = dateDateEs
            name = "ES " + code
            const fromM = SWEDISH_MONTHS[fromMon.toLowerCase().slice(0, 3)] ?? 0
            const toM = SWEDISH_MONTHS[toMon.toLowerCase().slice(0, 3)] ?? 0
            from = new Date(Date.UTC(y, fromM, parseInt(fromDay, 10), 0, 0))
            to = new Date(Date.UTC(y, toM, parseInt(toDay, 10), 23, 59))
        } else {
            i++
            continue
        }

        if (line.includes("ACFT") || line.includes("CIV") || line.includes("MIL") || line.includes("TT")) {
            comment = "FLYG"
        }

        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
            const next = lines[j]
            const ftMatch = next.match(/^(\d+)\s*ft$/i)
            const flMatch = next.match(/FL\s*(\d+)/i)
            if (ftMatch) {
                altitude = ftMatch[1]
                altitudeType = "ft"
                break
            }
            if (flMatch) {
                altitude = flMatch[1]
                altitudeType = "FL"
                break
            }
        }

        restrictions.push({ name, from, to, altitude, altitudeType, comment })
        i++
    }

    return restrictions
}

function restrictionToTopSkyLine(r: Restriction): string {
    const fmt = (d: Date) => {
        const y = String(d.getUTCFullYear()).slice(2)
        const m = String(d.getUTCMonth() + 1).padStart(2, "0")
        const day = String(d.getUTCDate()).padStart(2, "0")
        return y + m + day
    }
    const fmtHi = (d: Date) =>
        String(d.getUTCHours()).padStart(2, "0") + String(d.getUTCMinutes()).padStart(2, "0")
    const alt = r.altitudeType === "FL" ? r.altitude + "00" : r.altitude
    return `${r.name}:${fmt(r.from)}:${fmt(r.to)}:0:${fmtHi(r.from)}:${fmtHi(r.to)}:0:${alt}:${r.comment}`
}

export async function fetchLfvAup(): Promise<AupResult> {
    if (cache && Date.now() - cache.fetchedAt < AUP_CACHE_TTL_MS) {
        return cache
    }

    const { url, date } = await getPdfUrlForToday()
    const { data: pdfBuffer } = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 })
    const pdfData = await pdfParse(Buffer.from(pdfBuffer))
    const text = pdfData.text
    const restrictions = parseRestrictions(text)

    if (date && date !== todayUTC()) {
        console.warn(`[AUP] PDF date ${date} does not match today (UTC) ${todayUTC()}`)
    }

    cache = { restrictions, pdfDate: date, fetchedAt: Date.now() }
    return cache
}

export function restrictionsToTopSky(restrictions: Restriction[]): string[] {
    return restrictions.map(restrictionToTopSkyLine)
}

export function getRestrictionsJson(
    restrictions: Restriction[]
): Array<{ name: string; active: boolean; from: string; to: string; fl: string }> {
    return restrictions.map((r) => ({
        name: r.name,
        active: true,
        from: r.from.toISOString(),
        to: r.to.toISOString(),
        fl: r.altitudeType === "FL" ? `FL${r.altitude}` : `${r.altitude}ft`,
    }))
}
