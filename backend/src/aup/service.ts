import type { ParseWarning, Restriction, UsePlanMode, UsePlanResponse } from "./types"
import {
    extractTextFromPdf,
    fetchUsePlanPdfs,
    usePlanSelectionKey,
    type FetchedUsePlanPdfEntry,
} from "./fetcher"
import {
    filterRestrictions,
    parseUsePlanText,
    restrictionToJson,
    serializeTopSky,
    serializeTopSkyManualAct,
} from "./parser"
import { extractPlanDateUtc } from "./parser-modern"
import { parseUsePlanFromPdfLayout } from "./parser-layout"
import { detectStrikethroughAreas } from "./strikethrough"
import { getAupIds, normalizeAreaId, reloadAupIds } from "./topsky-areas-loader"

export { reloadAupIds, getAupIds }

const USEPLAN_TTL_MS =
    (parseInt(process.env.AUP_USEPLAN_TTL_SEC || process.env.LARA_USEPLAN_TTL_SEC || "3600", 10) ||
        3600) * 1000

interface RawUsePlanCache {
    fetchedAt: number
    selectionKey: string
    sourcePageUrl: string
    pdfUrls: string[]
    planDates: string[]
    rawRestrictions: Restriction[]
    parseWarnings: ParseWarning[]
    struckAreaIds: Set<string>
}

let rawCache: RawUsePlanCache | null = null

function planDateIsoToParts(iso: string): { year: number; month: number; day: number } {
    const [y, m, d] = iso.split("-").map(Number)
    return { year: y, month: m - 1, day: d }
}

async function parseOnePdf(
    entry: FetchedUsePlanPdfEntry,
): Promise<{ restrictions: Restriction[]; parseWarnings: ParseWarning[] }> {
    const text = await extractTextFromPdf(entry.buffer)
    const fromText = extractPlanDateUtc(text)
    const plan = fromText ?? planDateIsoToParts(entry.planDate)

    if (fromText || entry.planDate) {
        const layout = await parseUsePlanFromPdfLayout(entry.buffer, plan)
        if (layout.restrictions.length > 0) {
            return layout
        }
    }

    const parsed = parseUsePlanText(text)
    return parsed
}

async function parseAndMergePdfs(
    pdfs: FetchedUsePlanPdfEntry[],
): Promise<{
    restrictions: Restriction[]
    parseWarnings: ParseWarning[]
    struckAreaIds: Set<string>
}> {
    const restrictions: Restriction[] = []
    const parseWarnings: ParseWarning[] = []
    const struckAreaIds = new Set<string>()

    for (const entry of pdfs) {
        const { restrictions: rest, parseWarnings: warns } = await parseOnePdf(entry)
        const struck = await detectStrikethroughAreas(entry.buffer)
        for (const id of struck) {
            struckAreaIds.add(id)
        }
        for (const r of rest) {
            if (!struck.has(normalizeAreaId(r.name))) {
                restrictions.push(r)
            }
        }
        for (const w of warns) {
            parseWarnings.push({
                ...w,
                snippet: w.snippet ? `[${entry.planDate}] ${w.snippet}` : `[${entry.planDate}]`,
            })
        }
    }

    return { restrictions, parseWarnings, struckAreaIds }
}

async function loadRawUsePlan(refresh: boolean): Promise<RawUsePlanCache> {
    const selectionKey = usePlanSelectionKey()

    if (
        !refresh &&
        rawCache &&
        rawCache.selectionKey === selectionKey &&
        Date.now() - rawCache.fetchedAt < USEPLAN_TTL_MS
    ) {
        return rawCache
    }

    const bundle = await fetchUsePlanPdfs()
    const { restrictions, parseWarnings, struckAreaIds } = await parseAndMergePdfs(bundle.pdfs)

    rawCache = {
        fetchedAt: Date.now(),
        selectionKey,
        sourcePageUrl: bundle.sourcePageUrl,
        pdfUrls: bundle.pdfs.map((p) => p.pdfUrl),
        planDates: bundle.planDates,
        rawRestrictions: restrictions,
        parseWarnings,
        struckAreaIds,
    }
    console.log(
        `aup: merged ${bundle.planDates.join(" + ")} → ${restrictions.length} restrictions, ${struckAreaIds.size} struck through`,
    )
    return rawCache
}

export async function getUsePlan(options: {
    mode: UsePlanMode
    refreshPdf?: boolean
    refreshAreas?: boolean
}): Promise<UsePlanResponse> {
    if (options.refreshAreas) {
        await reloadAupIds()
    }
    const { ids: knownIds, areasCache } = await getAupIds({ refresh: options.refreshAreas })
    const raw = await loadRawUsePlan(!!options.refreshPdf)

    // Strikethrough is applied per PDF in parseAndMergePdfs; do not union struck ids here.
    const { included, excluded } = filterRestrictions(
        raw.rawRestrictions,
        options.mode,
        knownIds,
        new Set(),
    )

    return {
        fetchedAt: new Date(raw.fetchedAt).toISOString(),
        mode: options.mode,
        sourcePageUrl: raw.sourcePageUrl,
        pdfUrl: raw.pdfUrls.join(" | "),
        planDates: raw.planDates,
        areasCache,
        restrictions: included.map(restrictionToJson),
        struckAreaIds: [...raw.struckAreaIds].sort(),
        excluded,
        topsky: serializeTopSky(included),
        topskyManualAct: serializeTopSkyManualAct(included),
        parseWarnings: raw.parseWarnings,
    }
}
