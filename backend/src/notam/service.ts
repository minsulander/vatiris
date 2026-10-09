import axios from "axios"
import * as cheerio from "cheerio"
import moment from "moment"
import { parsePibPdf } from "./parser"
import { NOTAM_PROFILES, type NotamBulletinResponse, type NotamProfile } from "./types"

const LFV_BASE_URL = "https://aro.lfv.se"
const FILE_LIST_URL = `${LFV_BASE_URL}/Links/Link/ShowFileList?type=AIS&path=%5Cpibsweden%5C&torlinkName=NOTAM%20Sweden`

/** How often to re-check the LFV file list. PIBs are republished every 30 minutes. */
const LIST_TTL_MS = (parseInt(process.env.NOTAM_LIST_TTL_SEC || "300", 10) || 300) * 1000

const HTTP_OPTS = {
    timeout: 30_000,
    headers: { "User-Agent": "VatIRIS-NOTAM/1.0" },
}

/** e.g. ".../FileList/pibsweden//ESAA FIR IFR 24hr_20261009150014.pdf" */
const PIB_LINK_RE = /ESAA FIR (IFR|VFR|HKP) 24hr_(\d{14})\.pdf$/

export interface PibFileLink {
    profile: NotamProfile
    url: string
    publishedAt: string
}

let listCache: { fetchedAt: number; links: Partial<Record<NotamProfile, PibFileLink>> } | null = null
let listInflight: Promise<Partial<Record<NotamProfile, PibFileLink>>> | null = null

const bulletinCache = new Map<NotamProfile, NotamBulletinResponse>()
const bulletinInflight = new Map<NotamProfile, Promise<NotamBulletinResponse>>()
/** Source PDF of each cached bulletin, keyed by profile, served to the frontend PDF viewer */
const pdfCache = new Map<NotamProfile, { sourceUrl: string; buffer: Buffer }>()

export function parseProfile(s: string): NotamProfile | undefined {
    const upper = s.toUpperCase()
    return NOTAM_PROFILES.find((p) => p === upper)
}

/** Parse the LFV file list page, keeping the newest PDF per profile. */
export function parseFileList(html: string): Partial<Record<NotamProfile, PibFileLink>> {
    const $ = cheerio.load(html)
    const links: Partial<Record<NotamProfile, PibFileLink>> = {}
    $("a[href]").each((_, el) => {
        const href = decodeURI($(el).attr("href") || "")
        const m = href.match(PIB_LINK_RE)
        if (!m) return
        const profile = m[1] as NotamProfile
        const publishedAt = moment.utc(m[2], "YYYYMMDDHHmmss", true)
        if (!publishedAt.isValid()) return
        const link: PibFileLink = {
            profile,
            url: new URL(href, LFV_BASE_URL).href,
            publishedAt: publishedAt.toISOString(),
        }
        const existing = links[profile]
        if (!existing || existing.publishedAt < link.publishedAt) links[profile] = link
    })
    return links
}

async function getFileLinks(): Promise<Partial<Record<NotamProfile, PibFileLink>>> {
    if (listCache && Date.now() - listCache.fetchedAt < LIST_TTL_MS) return listCache.links
    if (!listInflight) {
        listInflight = (async () => {
            try {
                const response = await axios.get<string>(FILE_LIST_URL, {
                    ...HTTP_OPTS,
                    responseType: "text",
                })
                const links = parseFileList(response.data)
                if (Object.keys(links).length === 0) throw new Error("No PIB PDFs found in LFV file list")
                listCache = { fetchedAt: Date.now(), links }
                return links
            } finally {
                listInflight = null
            }
        })()
    }
    return listInflight
}

async function loadBulletin(link: PibFileLink): Promise<NotamBulletinResponse> {
    const response = await axios.get<ArrayBuffer>(link.url, {
        ...HTTP_OPTS,
        responseType: "arraybuffer",
    })
    const buffer = Buffer.from(response.data)
    const bulletin = await parsePibPdf(buffer, link.profile)
    pdfCache.set(link.profile, { sourceUrl: link.url, buffer })
    if (bulletin.parseWarnings.length > 0) {
        console.warn(`NOTAM ${link.profile} parse warnings:`, bulletin.parseWarnings)
    }
    console.log(
        `NOTAM ${link.profile} parsed ${link.url}: ${bulletin.aerodromes.length} aerodromes, ` +
            bulletin.sections.map((s) => `${s.title} ${s.notams.length}`).join(", "),
    )
    return {
        ...bulletin,
        sourceUrl: link.url,
        pdfPath: `/notam/${link.profile.toLowerCase()}/${moment.utc(link.publishedAt).format("YYYYMMDDHHmmss")}.pdf`,
        publishedAt: link.publishedAt,
        fetchedAt: new Date().toISOString(),
        stale: false,
    }
}

/**
 * Latest parsed bulletin for a profile. The LFV file list is checked at most every
 * LIST_TTL_MS and a PDF is only downloaded and parsed when a new one is published.
 * If LFV is unreachable, the last good bulletin is returned with `stale: true`.
 */
export async function getBulletin(profile: NotamProfile): Promise<NotamBulletinResponse> {
    const cached = bulletinCache.get(profile)
    try {
        const link = (await getFileLinks())[profile]
        if (!link) throw new Error(`No ${profile} PIB in LFV file list`)
        if (cached && cached.sourceUrl === link.url) return cached

        let inflight = bulletinInflight.get(profile)
        if (!inflight) {
            inflight = loadBulletin(link).finally(() => bulletinInflight.delete(profile))
            bulletinInflight.set(profile, inflight)
        }
        const bulletin = await inflight
        bulletinCache.set(profile, bulletin)
        return bulletin
    } catch (e) {
        if (cached) {
            console.error(`NOTAM ${profile} refresh failed, serving cached bulletin:`, e)
            return { ...cached, stale: true }
        }
        throw e
    }
}

/** Source PDF of the bulletin currently served for a profile */
export async function getBulletinPdf(profile: NotamProfile) {
    const bulletin = await getBulletin(profile)
    const pdf = pdfCache.get(profile)
    if (!pdf || pdf.sourceUrl !== bulletin.sourceUrl) throw new Error(`No cached ${profile} PDF`)
    return { bulletin, buffer: pdf.buffer }
}

export async function getIndex() {
    const links = await getFileLinks()
    return NOTAM_PROFILES.map((profile) => ({
        profile,
        url: links[profile]?.url,
        publishedAt: links[profile]?.publishedAt,
        cached: bulletinCache.has(profile),
    }))
}
