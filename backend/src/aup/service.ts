import type { ParseWarning, Restriction, UsePlanMode, UsePlanResponse } from "./types"
import { extractTextFromPdf, fetchLatestUsePlanPdf } from "./fetcher"
import {
    filterRestrictions,
    parseUsePlanText,
    restrictionToJson,
    serializeTopSky,
} from "./parser"
import { extractPlanDateUtc } from "./parser-modern"
import { parseUsePlanFromPdfLayout } from "./parser-layout"
import { detectStrikethroughAreas } from "./strikethrough"
import { getAupIds, reloadAupIds } from "./topsky-areas-loader"

export { reloadAupIds, getAupIds }

const USEPLAN_TTL_MS =
    (parseInt(process.env.AUP_USEPLAN_TTL_SEC || process.env.LARA_USEPLAN_TTL_SEC || "3600", 10) ||
        3600) * 1000

interface RawUsePlanCache {
    fetchedAt: number
    sourcePageUrl: string
    pdfUrl: string
    pdfBuffer: Buffer
    rawRestrictions: Restriction[]
    parseWarnings: ParseWarning[]
    struckAreaIds: Set<string>
}

let rawCache: RawUsePlanCache | null = null

async function loadRawUsePlan(refresh: boolean): Promise<RawUsePlanCache> {
    if (!refresh && rawCache && Date.now() - rawCache.fetchedAt < USEPLAN_TTL_MS) {
        return rawCache
    }

    const fetched = await fetchLatestUsePlanPdf()
    const text = await extractTextFromPdf(fetched.buffer)
    const planDate = extractPlanDateUtc(text)
    let restrictions: Restriction[]
    let parseWarnings: ParseWarning[]

    if (planDate) {
        const layout = await parseUsePlanFromPdfLayout(fetched.buffer, planDate)
        if (layout.restrictions.length > 0) {
            restrictions = layout.restrictions
            parseWarnings = layout.parseWarnings
        } else {
            const parsed = parseUsePlanText(text)
            restrictions = parsed.restrictions
            parseWarnings = parsed.parseWarnings
        }
    } else {
        const parsed = parseUsePlanText(text)
        restrictions = parsed.restrictions
        parseWarnings = parsed.parseWarnings
    }

    const struckAreaIds = await detectStrikethroughAreas(fetched.buffer)

    rawCache = {
        fetchedAt: Date.now(),
        sourcePageUrl: fetched.sourcePageUrl,
        pdfUrl: fetched.pdfUrl,
        pdfBuffer: fetched.buffer,
        rawRestrictions: restrictions,
        parseWarnings,
        struckAreaIds,
    }
    console.log(
        `aup: parsed ${restrictions.length} restrictions, ${struckAreaIds.size} struck through`,
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

    const { included, excluded } = filterRestrictions(
        raw.rawRestrictions,
        options.mode,
        knownIds,
        raw.struckAreaIds,
    )

    return {
        fetchedAt: new Date(raw.fetchedAt).toISOString(),
        mode: options.mode,
        sourcePageUrl: raw.sourcePageUrl,
        pdfUrl: raw.pdfUrl,
        areasCache,
        restrictions: included.map(restrictionToJson),
        struckAreaIds: [...raw.struckAreaIds].sort(),
        excluded,
        topsky: serializeTopSky(included),
        parseWarnings: raw.parseWarnings,
    }
}
