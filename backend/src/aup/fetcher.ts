import axios from "axios"
import * as cheerio from "cheerio"

export const LFV_BASE_URL = "https://aro.lfv.se"
export const LFV_DAILY_USE_PATH =
    "/Editorial/View/GeneralDocument?torLinkId=337&type=AIS&folderId=77"

/** From 12:00 UTC, merge today's and tomorrow's plans. Configurable via AUP_MERGE_UTC_HOUR. */
export const AUP_MERGE_UTC_HOUR =
    parseInt(process.env.AUP_MERGE_UTC_HOUR || "12", 10) || 12

const HTTP_OPTS = {
    timeout: 30_000,
    headers: { "User-Agent": "VatIRIS-AUP/1.0" },
}

/** Matches link label or URL path: "... 2026-05-24 ... version 3" */
const PLAN_LINK_META_RE = /(\d{4})-(\d{2})-(\d{2}).*?version\s*(\d+)/i

export interface UsePlanDocumentLink {
    href: string
    label: string
    planDate: string
    version: number
}

export interface FetchedUsePlanPdf {
    sourcePageUrl: string
    pdfUrl: string
    buffer: Buffer
}

export interface FetchedUsePlanPdfEntry {
    pdfUrl: string
    buffer: Buffer
    planDate: string
    version: number
    label: string
}

export interface FetchedUsePlanBundle {
    sourcePageUrl: string
    /** Dates included in this bundle (e.g. ["2026-05-23"] or ["2026-05-23","2026-05-24"]). */
    planDates: string[]
    pdfs: FetchedUsePlanPdfEntry[]
}

export function planDateUtcFrom(date: Date = new Date()): string {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, "0")
    const d = String(date.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

/** @deprecated Use planDateUtcFrom */
export function todayPlanDateUtc(): string {
    return planDateUtcFrom()
}

export function addUtcDays(planDate: string, days: number): string {
    const [y, m, d] = planDate.split("-").map(Number)
    return planDateUtcFrom(new Date(Date.UTC(y, m - 1, d + days)))
}

/**
 * Before 12:00 UTC: today only. From 12:00 UTC: today + tomorrow (if available on LFV page).
 */
export function targetPlanDatesUtc(now: Date = new Date()): string[] {
    const today = planDateUtcFrom(now)
    if (now.getUTCHours() < AUP_MERGE_UTC_HOUR) {
        return [today]
    }
    return [today, addUtcDays(today, 1)]
}

/** Cache key; changes at midnight UTC and again at merge hour. */
export function usePlanSelectionKey(now: Date = new Date()): string {
    return targetPlanDatesUtc(now).join("+")
}

export function parseUsePlanLinkMeta(href: string, label: string): UsePlanDocumentLink | null {
    const decodedHref = decodeURIComponent(href)
    const combined = `${label} ${decodedHref}`
    const m = combined.match(PLAN_LINK_META_RE)
    if (!m) return null
    return {
        href,
        label: label.trim(),
        planDate: `${m[1]}-${m[2]}-${m[3]}`,
        version: parseInt(m[4], 10),
    }
}

export function selectUsePlanPdfLink(
    links: UsePlanDocumentLink[],
    planDate: string = planDateUtcFrom(),
): UsePlanDocumentLink {
    const chosen = selectUsePlanPdfLinksForDates(links, [planDate])
    return chosen[0]
}

/** Newest version per plan date. Missing tomorrow is ignored; missing today warns and throws. */
export function selectUsePlanPdfLinksForDates(
    links: UsePlanDocumentLink[],
    planDates: string[],
): UsePlanDocumentLink[] {
    const chosen: UsePlanDocumentLink[] = []
    const requiredDate = planDates[0]

    for (const planDate of planDates) {
        const forDate = links.filter((l) => l.planDate === planDate)
        if (forDate.length === 0) {
            continue
        }
        chosen.push(forDate.reduce((best, cur) => (cur.version > best.version ? cur : best)))
    }

    const hasRequired = chosen.some((l) => l.planDate === requiredDate)
    if (!hasRequired) {
        const available = [...new Set(links.map((l) => l.planDate))].sort().join(", ")
        console.warn(`aup: no PDF on LFV page for plan date: ${requiredDate}`)
        throw new Error(
            `No daily use plan PDF for ${requiredDate}. Available plan dates: ${available || "none"}`,
        )
    }

    return chosen
}

export function collectUsePlanDocumentLinks(
    hrefs: string[],
    labels: string[],
): UsePlanDocumentLink[] {
    const parsed: UsePlanDocumentLink[] = []
    for (let i = 0; i < hrefs.length; i++) {
        const meta = parseUsePlanLinkMeta(hrefs[i], labels[i] ?? "")
        if (meta) parsed.push(meta)
    }
    return parsed
}

export async function listUsePlanDocumentLinks(): Promise<{
    sourcePageUrl: string
    links: UsePlanDocumentLink[]
}> {
    const sourcePageUrl = `${LFV_BASE_URL}${LFV_DAILY_USE_PATH}`
    const htmlRes = await axios.get<string>(sourcePageUrl, { ...HTTP_OPTS, responseType: "text" })
    const $ = cheerio.load(htmlRes.data)
    const anchors = $("a.document-link").toArray()

    if (anchors.length === 0) {
        throw new Error("No a.document-link found on LFV airspace use plan page")
    }

    const hrefs: string[] = []
    const labels: string[] = []
    for (const el of anchors) {
        const href = $(el).attr("href")
        if (href) {
            hrefs.push(href)
            labels.push($(el).text())
        }
    }

    const links = collectUsePlanDocumentLinks(hrefs, labels)
    if (links.length === 0) {
        throw new Error("Could not parse plan date/version from any a.document-link on LFV page")
    }

    return { sourcePageUrl, links }
}

async function downloadUsePlanPdf(link: UsePlanDocumentLink): Promise<FetchedUsePlanPdfEntry> {
    const pdfUrl = link.href.startsWith("http") ? link.href : `${LFV_BASE_URL}${link.href}`
    const pdfRes = await axios.get<ArrayBuffer>(pdfUrl, {
        ...HTTP_OPTS,
        responseType: "arraybuffer",
    })
    return {
        pdfUrl,
        buffer: Buffer.from(pdfRes.data),
        planDate: link.planDate,
        version: link.version,
        label: link.label,
    }
}

export async function fetchUsePlanPdfs(now: Date = new Date()): Promise<FetchedUsePlanBundle> {
    const planDates = targetPlanDatesUtc(now)
    const { sourcePageUrl, links } = await listUsePlanDocumentLinks()
    const selected = selectUsePlanPdfLinksForDates(links, planDates)

    const pdfs: FetchedUsePlanPdfEntry[] = []
    for (const link of selected) {
        pdfs.push(await downloadUsePlanPdf(link))
    }

    const hour = now.getUTCHours()
    const mode =
        planDates.length > 1
            ? `merge from ${AUP_MERGE_UTC_HOUR}:00 UTC (now ${String(hour).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}Z)`
            : `single day before ${AUP_MERGE_UTC_HOUR}:00 UTC`
    console.log(
        `aup: ${mode} → ${pdfs.map((p) => `${p.planDate} v${p.version}`).join(" + ")}`,
    )

    return { sourcePageUrl, planDates: pdfs.map((p) => p.planDate), pdfs }
}

/** First PDF of the current selection (probes / legacy). */
export async function fetchLatestUsePlanPdf(): Promise<FetchedUsePlanPdf> {
    const bundle = await fetchUsePlanPdfs()
    const first = bundle.pdfs[0]
    if (!first) {
        throw new Error("No use plan PDF downloaded")
    }
    return {
        sourcePageUrl: bundle.sourcePageUrl,
        pdfUrl: first.pdfUrl,
        buffer: first.buffer,
    }
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    const pdfParse = (await import("pdf-parse")).default
    const result = await pdfParse(buffer)
    return result.text
}
