export type UsePlanMode = "all" | "sectorfile"

export type AltitudeType = "ft" | "FL"

export interface Restriction {
    name: string
    from: Date
    to: Date
    /** Lower vertical limit (FL level, or feet AMSL). */
    altitude: string
    altitudeType: AltitudeType
    /** Upper vertical limit for a flight-level band (e.g. FL095–FL285). */
    altitudeUpper?: string
    comment: string
}

export interface ParseWarning {
    line?: number
    snippet?: string
    message: string
}

export interface AreasCacheMeta {
    fetchedAt: string
    expiresAt: string
    sourceUrl: string
    count: number
    stale: boolean
}

export interface ExcludedRestriction {
    name: string
    reason: "not_in_sectorfile" | "strikethrough"
}

export interface RestrictionJson {
    name: string
    from: string
    to: string
    altitude: string
    altitudeType: AltitudeType
    altitudeUpper?: string
    comment: string
}

export interface UsePlanResponse {
    fetchedAt: string
    mode: UsePlanMode
    sourcePageUrl: string
    pdfUrl: string
    areasCache: AreasCacheMeta
    restrictions: RestrictionJson[]
    struckAreaIds: string[]
    excluded: ExcludedRestriction[]
    topsky: string
    parseWarnings: ParseWarning[]
}

export interface AupIdsResponse {
    ids: string[]
    areasCache: AreasCacheMeta
}
