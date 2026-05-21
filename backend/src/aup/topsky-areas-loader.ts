import axios from "axios"
import type { AreasCacheMeta } from "./types"

const DEFAULT_TOPSKY_AREAS_URL =
    process.env.TOPSKY_AREAS_URL ||
    "https://raw.githubusercontent.com/Vatsim-Scandinavia/ESAA-Sectorfile/main/OTHER/TopSkyAreas.txt"

const TTL_MS =
    (parseInt(process.env.LARA_AUP_IDS_TTL_SEC || "86400", 10) || 86400) * 1000

const HTTP_OPTS = {
    timeout: 30_000,
    headers: { "User-Agent": "VatIRIS-AUP/1.0" },
}

interface AupIdsCacheEntry {
    ids: Set<string>
    fetchedAt: number
    sourceUrl: string
}

let cache: AupIdsCacheEntry | null = null

export function extractAupIdsFromTopSkyAreas(text: string): string[] {
    const ids = new Set<string>()
    const re = /ACTIVE:AUP:(\S+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
        ids.add(m[1].toUpperCase())
    }
    return [...ids].sort()
}

function isExpired(entry: AupIdsCacheEntry): boolean {
    return Date.now() - entry.fetchedAt >= TTL_MS
}

export function areasCacheMeta(entry: AupIdsCacheEntry | null): AreasCacheMeta {
    if (!entry) {
        return {
            fetchedAt: "",
            expiresAt: "",
            sourceUrl: DEFAULT_TOPSKY_AREAS_URL,
            count: 0,
            stale: true,
        }
    }
    const expiresAt = new Date(entry.fetchedAt + TTL_MS)
    return {
        fetchedAt: new Date(entry.fetchedAt).toISOString(),
        expiresAt: expiresAt.toISOString(),
        sourceUrl: entry.sourceUrl,
        count: entry.ids.size,
        stale: isExpired(entry),
    }
}

async function fetchFromGitHub(sourceUrl: string): Promise<AupIdsCacheEntry> {
    const res = await axios.get<string>(sourceUrl, { ...HTTP_OPTS, responseType: "text" })
    const idList = extractAupIdsFromTopSkyAreas(res.data)
    const entry: AupIdsCacheEntry = {
        ids: new Set(idList),
        fetchedAt: Date.now(),
        sourceUrl,
    }
    cache = entry
    console.log(`aup: loaded ${entry.ids.size} ACTIVE:AUP ids from sector file`)
    return entry
}

export async function getAupIds(options?: { refresh?: boolean }): Promise<{
    ids: Set<string>
    areasCache: AreasCacheMeta
}> {
    const sourceUrl = DEFAULT_TOPSKY_AREAS_URL
    if (options?.refresh || !cache || isExpired(cache)) {
        await fetchFromGitHub(sourceUrl)
    }
    return { ids: cache!.ids, areasCache: areasCacheMeta(cache) }
}

export async function reloadAupIds(): Promise<AupIdsResponseInternal> {
    const entry = await fetchFromGitHub(DEFAULT_TOPSKY_AREAS_URL)
    return {
        ids: [...entry.ids].sort(),
        areasCache: areasCacheMeta(entry),
    }
}

interface AupIdsResponseInternal {
    ids: string[]
    areasCache: AreasCacheMeta
}

export function normalizeAreaId(name: string): string {
    return name.replace(/\s+/g, "").toUpperCase()
}
