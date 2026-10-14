/**
 * ESSA SEP / DLV / DEP GAP preload (no EFS) — rules mirrored from vatefs
 * `common/src/essa-sep-indicators.ts` + `essa-rwy-config.ts`.
 */

export interface EssaSepIndicators {
    sep: string
    dlv: string
    depGap: string
    info: string
}

interface EssaRwyCombination {
    id: string
    arr: string[]
    arrAliases?: string[][]
    dep: string[]
    night?: boolean
}

const ESSA_RWY_COMBINATIONS: EssaRwyCombination[] = [
    { id: "1", arr: ["01R"], arrAliases: [["01L", "01R"]], dep: ["01L"] },
    { id: "2", arr: ["19L"], arrAliases: [["19L", "19R"]], dep: ["19R"] },
    { id: "3", arr: ["01L"], dep: ["01L"] },
    { id: "4", arr: ["01L"], dep: ["08"] },
    { id: "5", arr: ["01R"], dep: ["08"] },
    { id: "6", arr: ["01R"], dep: ["01R"] },
    { id: "7", arr: ["08"], dep: ["08"] },
    { id: "8", arr: ["08"], dep: ["19L"] },
    { id: "9A", arr: ["19L"], dep: ["19L"] },
    { id: "9B", arr: ["19L"], dep: ["19L"], night: true },
    { id: "9C", arr: ["19L"], dep: ["19L"] },
    { id: "10", arr: ["19R"], dep: ["08"] },
    { id: "11", arr: ["19R"], dep: ["19L"] },
    { id: "12", arr: ["19R"], dep: ["19R"] },
    { id: "13", arr: ["26"], dep: ["01L"] },
    { id: "14", arr: ["26"], dep: ["19R"] },
    { id: "15A", arr: ["26"], dep: ["19L"] },
    { id: "15B", arr: ["26"], dep: ["19L"], night: true },
    { id: "15C", arr: ["26"], dep: ["19L"] },
    { id: "16", arr: ["26"], dep: ["26"] },
]

export function normalizeEssaRwy(rwy: string): string {
    return rwy.toUpperCase().replace(/[^0-9LRC]/g, "")
}

function sameSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    const sa = [...a].map(normalizeEssaRwy).sort()
    const sb = [...b].map(normalizeEssaRwy).sort()
    return sa.every((v, i) => v === sb[i])
}

function arrMatchesCombo(arr: string[], combo: EssaRwyCombination): boolean {
    if (sameSet(combo.arr, arr)) return true
    return (combo.arrAliases ?? []).some((alias) => sameSet(alias, arr))
}

function isEssaRwyDayHours(now: Date = new Date()): boolean {
    const hourStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Stockholm",
        hour: "2-digit",
        hour12: false,
    }).format(now)
    const hour = Number(hourStr)
    const h = hour === 24 ? 0 : hour
    return h >= 6 && h < 22
}

function dayRank(c: EssaRwyCombination): number {
    if (c.night) return 3
    if (c.id.endsWith("A")) return 0
    if (c.id.endsWith("C")) return 1
    return 2
}

function nightRank(c: EssaRwyCombination): number {
    if (c.night) return 0
    if (c.id.endsWith("A")) return 1
    if (c.id.endsWith("C")) return 2
    return 3
}

export function resolveEssaRwyConfigId(
    arr: string[],
    dep: string[],
    now: Date = new Date(),
): string | null {
    if (arr.length === 0 || dep.length === 0) return null
    const matches = ESSA_RWY_COMBINATIONS.filter(
        (c) => arrMatchesCombo(arr, c) && sameSet(c.dep, dep),
    )
    if (matches.length === 0) return null
    if (matches.length === 1) return matches[0]!.id
    const night = !isEssaRwyDayHours(now)
    const ranked = [...matches].sort((a, b) =>
        night ? nightRank(a) - nightRank(b) : dayRank(a) - dayRank(b),
    )
    return ranked[0]!.id
}

export function getEssaRwyCombination(id: string): EssaRwyCombination | undefined {
    return ESSA_RWY_COMBINATIONS.find((c) => c.id === id)
}

/**
 * Non-standard DEP RWY (vatefs FlightStrip `rwyNonStandard`):
 * strip RWY not in ES-active DEP list and/or outside selected ESSA config DEP.
 */
export function isDepRwyNonStandard(options: {
    runway: string | null | undefined
    /** Active ES / AWOS departure runways (empty = skip ES check). */
    activeDepRunways: string[]
    arrRunway?: string | null
    icao?: string | null
}): boolean {
    const norm = normalizeEssaRwy(options.runway || "")
    if (!norm) return false

    const esNorm = options.activeDepRunways.map(normalizeEssaRwy).filter(Boolean)
    const matchesEs = esNorm.length === 0 || esNorm.includes(norm)

    let matchesConfig = true
    const icao = (options.icao || "").toUpperCase()
    if (icao === "ESSA" && esNorm.length > 0) {
        const arr = options.arrRunway ? [normalizeEssaRwy(options.arrRunway)] : esNorm.slice(0, 1)
        const configId = resolveEssaRwyConfigId(arr, esNorm.slice(0, 1))
        const combo = configId ? getEssaRwyCombination(configId) : undefined
        if (combo) {
            matchesConfig = combo.dep.map(normalizeEssaRwy).includes(norm)
        }
    }

    return !matchesEs || !matchesConfig
}

function essaSccLookupDesignator(rwy: string): string {
    const n = normalizeEssaRwy(rwy)
    if (n === "19R") return "01L"
    if (n === "19L") return "01R"
    if (n === "26") return "08"
    return n
}

/** SEP: 3 nm if any ARR SCC third ≤ 4, else 2.5 nm (also when no SCC). */
export function resolveEssaSepNm(
    arrRunways: string[],
    sccByDesignator: Map<string, [number, number, number]>,
): number {
    for (const r of arrRunways) {
        if (!r) continue
        const trip = sccByDesignator.get(essaSccLookupDesignator(r))
        if (!trip) continue
        if (trip.some((n) => n <= 4)) return 3
    }
    return 2.5
}

/** DLV: 2.5 nm default; config 5 → 3.5; 8/14 → 4. */
export function resolveEssaDlvNm(configId: string | null | undefined): number {
    switch (configId) {
        case "5":
            return 3.5
        case "8":
        case "14":
            return 4
        default:
            return 2.5
    }
}

function isEssaSingleRwyConfig(configId: string | null | undefined): boolean {
    if (!configId) return false
    const combo = getEssaRwyCombination(configId)
    if (!combo) return false
    if (combo.arr.length !== 1 || combo.dep.length !== 1) return false
    return normalizeEssaRwy(combo.arr[0]!) === normalizeEssaRwy(combo.dep[0]!)
}

/** DEP GAP: single-RWY only — 8 for config 7, else 6 VMC / 7 IMC. */
export function resolveEssaDepGapNm(
    configId: string | null | undefined,
    imc: boolean,
): number | null {
    if (!isEssaSingleRwyConfig(configId)) return null
    if (configId === "7") return 8
    return imc ? 7 : 6
}

function formatNm(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function computeEssaSepPreload(options: {
    arrRunway: string | null | undefined
    depRunway: string | null | undefined
    sccAll?: { matchedKey: string; thirds: number[] | null; closed?: boolean }[]
    flightCategory?: "VMC" | "IMC" | null
    /** When true (no EFS), INFO shows NO EFS; when false, INFO is empty. */
    noEfs: boolean
}): EssaSepIndicators {
    const arr = options.arrRunway ? [normalizeEssaRwy(options.arrRunway)] : []
    const dep = options.depRunway ? [normalizeEssaRwy(options.depRunway)] : []
    const configId = resolveEssaRwyConfigId(arr, dep)

    const sccMap = new Map<string, [number, number, number]>()
    for (const e of options.sccAll || []) {
        if (!e.thirds || e.thirds.length < 3 || e.closed) continue
        const key = normalizeEssaRwy(e.matchedKey)
        sccMap.set(key, [e.thirds[0]!, e.thirds[1]!, e.thirds[2]!])
    }

    const sep = resolveEssaSepNm(arr, sccMap)
    const dlv = resolveEssaDlvNm(configId)
    const imc = options.flightCategory === "IMC"
    const gap = resolveEssaDepGapNm(configId, imc)

    return {
        sep: formatNm(sep),
        dlv: formatNm(dlv),
        depGap: gap == null ? "" : formatNm(gap),
        info: options.noEfs ? "NO EFS" : "",
    }
}
