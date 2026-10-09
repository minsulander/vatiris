export const NOTAM_PROFILES = ["IFR", "VFR", "HKP"] as const
export type NotamProfile = (typeof NOTAM_PROFILES)[number]

export interface Notam {
    /** "notam" = regular NOTAM, "ref" = "please see NOTAM X :- LOC" pointer, "snowtam" = SNOWTAM block */
    type: "notam" | "ref" | "snowtam"
    /** NOTAM series/number, e.g. "B3330/26" */
    id?: string
    /** PIB legend marker: "+" not older than 250 days, "*" different from original, "-" older */
    marker?: string
    text: string
    /** ISO 8601 UTC */
    from?: string
    to?: string
    toEstimated?: boolean
    permanent?: boolean
    schedule?: string
    lower?: string
    upper?: string
    /** For type "ref": the NOTAM being referenced and where it is published */
    refId?: string
    refLocation?: string
}

export interface NotamAerodrome {
    icao: string
    name: string
    notams: Notam[]
}

export interface NotamSection {
    title: string
    notams: Notam[]
}

export interface NotamBulletin {
    profile: NotamProfile
    /** PIB id, e.g. "ES972610090298" */
    bulletinId?: string
    validFrom?: string
    validTo?: string
    /** Raw header text of the PIB (page 1, before the first section) */
    header: string
    aerodromes: NotamAerodrome[]
    /** Non-aerodrome sections in document order, e.g. EN-ROUTE, NAV WARNINGS */
    sections: NotamSection[]
    footer: string
    parseWarnings: string[]
}

export interface NotamBulletinResponse extends NotamBulletin {
    sourceUrl: string
    /** Backend path of the cached source PDF, unique per publication */
    pdfPath: string
    /** Publication time encoded in the LFV filename (ISO) */
    publishedAt?: string
    fetchedAt: string
    /** True when the latest fetch failed and an older cached bulletin is served */
    stale: boolean
}
