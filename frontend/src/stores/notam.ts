import useEventBus from "@/eventbus"
import { backendBaseUrl } from "@/stores/auth"
import axios from "axios"
import { defineStore } from "pinia"
import { reactive } from "vue"

export const notamProfiles = ["IFR", "VFR", "HKP"] as const
export type NotamProfile = (typeof notamProfiles)[number]

export interface Notam {
    type: "notam" | "ref" | "snowtam"
    id?: string
    marker?: string
    text: string
    from?: Date
    to?: Date
    toEstimated?: boolean
    permanent?: boolean
    schedule?: string
    lower?: string
    upper?: string
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
    bulletinId?: string
    validFrom?: Date
    validTo?: Date
    publishedAt?: Date
    header: string
    aerodromes: NotamAerodrome[]
    sections: NotamSection[]
    footer: string
    sourceUrl: string
    pdfPath: string
    stale: boolean
}

const toDate = (s?: string) => (s ? new Date(s) : undefined)

function toNotam(n: any): Notam {
    return { ...n, from: toDate(n.from), to: toDate(n.to) }
}

export const useNotamStore = defineStore("notam", () => {
    const bus = useEventBus()

    const bulletins = reactive({} as Partial<Record<NotamProfile, NotamBulletin>>)
    const loading = reactive({} as Partial<Record<NotamProfile, boolean>>)
    const errors = reactive({} as Partial<Record<NotamProfile, string>>)

    async function fetch(profile: NotamProfile) {
        if (loading[profile]) return
        loading[profile] = true
        try {
            const { data } = await axios.get(`${backendBaseUrl}/notam/${profile.toLowerCase()}`)
            bulletins[profile] = {
                ...data,
                validFrom: toDate(data.validFrom),
                validTo: toDate(data.validTo),
                publishedAt: toDate(data.publishedAt),
                aerodromes: data.aerodromes.map((ad: any) => ({
                    ...ad,
                    notams: ad.notams.map(toNotam),
                })),
                sections: data.sections.map((s: any) => ({ ...s, notams: s.notams.map(toNotam) })),
            }
            delete errors[profile]
        } catch (error: any) {
            console.error(`Failed to fetch ${profile} NOTAMs`, error)
            errors[profile] = error.response?.data || error.message || `${error}`
        } finally {
            loading[profile] = false
        }
    }

    bus.on("refresh", refresh)

    function refresh() {
        for (const profile of notamProfiles) {
            if (bulletins[profile] || errors[profile]) fetch(profile)
        }
    }

    return {
        bulletins,
        loading,
        errors,
        fetch,
        refresh,
    }
})
