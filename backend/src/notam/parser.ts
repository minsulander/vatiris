import moment from "moment"
import type { Notam, NotamAerodrome, NotamBulletin, NotamProfile, NotamSection } from "./types"

/**
 * Parser for LFV "Pre-Flight Information Bulletin" PDFs (ESAA FIR IFR/VFR/HKP 24hr).
 *
 * The PDFs use a monospaced font, so text is rebuilt into fixed-width lines where the
 * leading spaces reflect the original indentation:
 *
 *   ESCF - LINKOEPING/MALMEN                     <- aerodrome heading (column 0)
 *   +  MIL PAPI RWY 26 U/S.                      <- marker in column 0 starts a NOTAM
 *      FROM: 03 AUG 2026 10:15    TO: 03 NOV ... <- NOTAM id is in a right-hand column
 *      SCHEDULE: DAILY 0400-1800                 <- may follow the FROM line
 *
 * The last line of each page is repeated at the top of the next page; those are dropped.
 */

export interface PibLine {
    /** Fixed-width text; leading spaces are the indentation relative to the left margin */
    text: string
    /** NOTAM id found in the right-hand column on the same row */
    id?: string
}

const NOTAM_ID_RE = /^[A-Z]\d{4}\/\d{2}$/
const PAGE_RE = /^Page \d+ of \d+$/
const DATE_FORMAT = "DD MMM YYYY HH:mm"
const NO_INFO = "No information received or matching the query"

interface PdfTextItem {
    str: string
    x: number
    y: number
    width: number
}

/** Extract fixed-width lines from a PIB PDF, page by page, with page-top repeats removed. */
export async function extractPibLines(pdfBuffer: Buffer): Promise<PibLine[]> {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise

    const pages: PdfTextItem[][] = []
    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p)
        const content = await page.getTextContent()
        pages.push(
            (content.items as Array<{ str?: string; transform: number[]; width: number }>)
                .filter((it) => it.str && it.str.trim())
                .map((it) => ({
                    str: it.str!.trim(),
                    x: it.transform[4],
                    y: it.transform[5],
                    width: it.width,
                })),
        )
    }

    const all = pages.flat()
    if (all.length === 0) return []
    const leftMargin = Math.min(...all.map((it) => it.x))
    const charWidths = all
        .filter((it) => it.str.length >= 4)
        .map((it) => it.width / it.str.length)
        .sort((a, b) => a - b)
    const charWidth = charWidths[Math.floor(charWidths.length / 2)] || 5.44
    // NOTAM ids sit in a column far to the right of the text body
    const idColumnX = leftMargin + 60 * charWidth

    const lines: PibLine[] = []
    for (const [pageIndex, items] of pages.entries()) {
        const pageLines = itemsToLines(items, leftMargin, charWidth, idColumnX).filter((line) => !PAGE_RE.test(line.text.trim()))
        if (pageIndex > 0) {
            const repeated = repeatedLineCount(lines, pageLines)
            for (let i = 0; i < repeated; i++) {
                lines[lines.length - repeated + i].id ??= pageLines[i].id
            }
            pageLines.splice(0, repeated)
        }
        lines.push(...pageLines)
    }
    return lines
}

function lineKey(line: PibLine) {
    return line.text.trim().replace(/\s+/g, " ")
}

/** Number of lines (usually 1, sometimes a few) repeated from the end of the previous page */
function repeatedLineCount(prev: PibLine[], page: PibLine[]) {
    for (let n = Math.min(6, prev.length, page.length); n > 0; n--) {
        const tail = prev.slice(prev.length - n)
        if (tail.every((line, i) => lineKey(line) === lineKey(page[i]))) return n
    }
    return 0
}

function itemsToLines(items: PdfTextItem[], leftMargin: number, charWidth: number, idColumnX: number): PibLine[] {
    const isId = (it: PdfTextItem) => it.x >= idColumnX && NOTAM_ID_RE.test(it.str)

    // PDF y grows upwards
    const sorted = items.filter((it) => !isId(it)).sort((a, b) => b.y - a.y || a.x - b.x)
    const rows: { y: number; items: PdfTextItem[] }[] = []
    for (const it of sorted) {
        const row = rows[rows.length - 1]
        if (row && row.y - it.y <= 3) row.items.push(it)
        else rows.push({ y: it.y, items: [it] })
    }

    const lines: (PibLine & { y: number })[] = rows.map((row) => {
        row.items.sort((a, b) => a.x - b.x)
        let text = ""
        let prevEnd = -Infinity
        for (const it of row.items) {
            // Only the leading indentation is positional; headings use a proportional font,
            // so gaps inside a line collapse to a single space
            if (!text) text = " ".repeat(Math.max(0, Math.round((it.x - leftMargin) / charWidth)))
            else if (it.x - prevEnd > charWidth * 0.3) text += " "
            text += it.str
            prevEnd = it.x + it.width
        }
        return { text: text.trimEnd(), y: row.y }
    })

    // Ids belong to FROM lines but can be drawn up to about a line off; prefer the nearest
    // FROM row, falling back to whatever row is closest
    const nearest = (y: number, candidates: typeof lines, maxDistance: number) => {
        let best: (typeof lines)[number] | undefined
        for (const line of candidates) {
            if (!best || Math.abs(line.y - y) < Math.abs(best.y - y)) best = line
        }
        return best && Math.abs(best.y - y) <= maxDistance ? best : undefined
    }
    const fromLines = lines.filter((l) => l.text.trim().startsWith("FROM:"))
    for (const it of items.filter(isId)) {
        const line = nearest(it.y, fromLines, 14) ?? nearest(it.y, lines, 6)
        if (line) line.id = it.str
        else lines.push({ text: "", y: it.y, id: it.str })
    }

    return lines.sort((a, b) => b.y - a.y).map(({ text, id }) => (id ? { text, id } : { text }))
}

/** Convert pdftotext-style layout text (id at end of line) to PibLines. Mainly for tests. */
export function textToPibLines(text: string): PibLine[] {
    return text.split("\n").map((raw) => {
        const m = raw.match(/^(.*?)\s{2,}([A-Z]\d{4}\/\d{2})\s*$/)
        return m ? { text: m[1].trimEnd(), id: m[2] } : { text: raw.trimEnd() }
    })
}

export function parseDate(s: string): string | undefined {
    const m = moment.utc(s.trim(), DATE_FORMAT, "en", true)
    return m.isValid() ? m.toISOString() : undefined
}

interface PendingNotam {
    notam: Notam
    /** Text following the marker on the first line */
    lead: string
    /** Following lines with indentation kept, dedented when finalized */
    body: string[]
}

export function parsePibLines(lines: PibLine[], profile: NotamProfile): NotamBulletin {
    const bulletin: NotamBulletin = {
        profile,
        header: "",
        aerodromes: [],
        sections: [],
        footer: "",
        parseWarnings: [],
    }
    const warn = (msg: string) => {
        if (bulletin.parseWarnings.length < 100) bulletin.parseWarnings.push(msg)
    }

    // Header: everything before the "ESAA - SWEDEN FIR" line
    let start = lines.findIndex((l) => /^[A-Z]{4} - .*\bFIR$/.test(l.text))
    if (start < 0) {
        warn("FIR heading not found")
        start = 0
    }
    const headerLines = lines.slice(0, start).map((l) => l.text)
    while (headerLines.length && !headerLines[headerLines.length - 1].trim()) headerLines.pop()
    bulletin.header = headerLines.join("\n")
    const headerFlat = headerLines.join(" ").replace(/\s+/g, " ")
    const validity = headerFlat.match(/(\d\d [A-Z]{3} \d{4} \d\d:\d\d) - (\d\d [A-Z]{3} \d{4} \d\d:\d\d)/)
    if (validity) {
        bulletin.validFrom = parseDate(validity[1])
        bulletin.validTo = parseDate(validity[2])
    }
    bulletin.bulletinId = headerFlat.match(/\bId: (\S+)/)?.[1]

    let target: Notam[] | undefined
    let aerodrome: NotamAerodrome | undefined
    let section: "ad" | NotamSection | undefined
    let pending: PendingNotam | undefined
    let inFooter = false
    const footerLines: string[] = []

    const flush = () => {
        if (pending) finalizeNotam(pending, warn)
        pending = undefined
    }

    for (const line of lines.slice(start + 1)) {
        const t = line.text.trim()
        if (inFooter) {
            footerLines.push(t)
            continue
        }
        if (!t) continue
        if (t === "END OF PIB") {
            flush()
            inFooter = true
            continue
        }

        const indent = line.text.length - line.text.trimStart().length
        if (indent <= 1) {
            // The marker is occasionally alone on its row with the text on the next
            const marker = line.text.match(/^\s*([+*-])(?:\s+(\S.*))?$/)
            if (marker && target) {
                flush()
                const notam: Notam = { type: "notam", marker: marker[1], text: "" }
                pending = { notam, lead: marker[2] ?? "", body: [] }
                if (line.id) notam.id = line.id
                target.push(notam)
                continue
            }
            if (t === "SNOWTAM" && target) {
                flush()
                const notam: Notam = { type: "snowtam", text: "" }
                pending = { notam, lead: "", body: [] }
                target.push(notam)
                continue
            }
            flush()
            const ad = t.match(/^([A-Z]{4}) - (.+)$/)
            if (section === "ad" && ad) {
                aerodrome = { icao: ad[1], name: ad[2].trim(), notams: [] }
                bulletin.aerodromes.push(aerodrome)
                target = aerodrome.notams
            } else if (t === "AERODROMES") {
                section = "ad"
                target = undefined
            } else {
                section = { title: t, notams: [] }
                bulletin.sections.push(section)
                target = section.notams
                aerodrome = undefined
            }
            continue
        }

        if (t === NO_INFO) continue
        if (!pending) {
            warn(`Unexpected line outside NOTAM: ${t}`)
            continue
        }
        if (line.id && !pending.notam.id) pending.notam.id = line.id
        pending.body.push(line.text)
    }
    flush()

    while (footerLines.length && !footerLines[footerLines.length - 1]) footerLines.pop()
    bulletin.footer = footerLines.join("\n")
    if (!inFooter) warn("END OF PIB not found")

    return bulletin
}

function finalizeNotam(pending: PendingNotam, warn: (msg: string) => void) {
    const { notam } = pending
    const content: string[] = []

    for (const raw of pending.body) {
        const t = raw.trim()
        const from = t.match(/^FROM:\s*(\d\d [A-Z]{3} \d{4} \d\d:\d\d)(?:\s+TO:\s*(.+))?$/)
        if (from && !notam.from) {
            notam.from = parseDate(from[1])
            const to = from[2]?.trim()
            if (to === "PERM") notam.permanent = true
            else if (to) {
                notam.toEstimated = /\bEST$/.test(to)
                notam.to = parseDate(to.replace(/\s*EST$/, ""))
                if (!notam.to) warn(`Invalid TO date "${to}" in ${notam.id ?? t}`)
            }
            if (!notam.from) warn(`Invalid FROM date in ${notam.id ?? t}`)
            continue
        }
        const schedule = t.match(/^SCHEDULE:\s*(.+)$/)
        if (schedule && notam.from) {
            notam.schedule = schedule[1]
            continue
        }
        const limit = t.match(/^(LOWER|UPPER):\s*(.+)$/)
        if (limit) {
            if (limit[1] === "LOWER") notam.lower = limit[2]
            else notam.upper = limit[2]
        }
        content.push(raw)
    }

    // Dedent to the least indented content line
    const minIndent = Math.min(...content.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length))
    notam.text = [pending.lead, ...content.map((l) => (Number.isFinite(minIndent) ? l.slice(minIndent) : l).trimEnd())].join("\n").trim()

    const ref = notam.text.match(/^please see NOTAM ([A-Z]\d{4}\/\d{2})(?:\s*:-\s*(\S+))?$/i)
    if (ref) {
        notam.type = "ref"
        notam.refId = ref[1]
        if (ref[2]) notam.refLocation = ref[2]
    }
}

export async function parsePibPdf(pdfBuffer: Buffer, profile: NotamProfile) {
    return parsePibLines(await extractPibLines(pdfBuffer), profile)
}
