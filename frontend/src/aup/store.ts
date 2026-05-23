import axios from "axios"
import { defineStore } from "pinia"
import { ref } from "vue"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

export type UsePlanMode = "all" | "sectorfile"

export interface UsePlanResponse {
    fetchedAt: string
    mode: UsePlanMode
    sourcePageUrl: string
    pdfUrl: string
    areasCache: {
        fetchedAt: string
        expiresAt: string
        sourceUrl: string
        count: number
        stale: boolean
    }
    restrictions: unknown[]
    struckAreaIds: string[]
    excluded: { name: string; reason: string }[]
    topsky: string
    parseWarnings: unknown[]
}

export const useAupStore = defineStore("aup", () => {
    const usePlan = ref<UsePlanResponse | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function fetchUsePlan(options?: {
        mode?: UsePlanMode
        refresh?: boolean
        refreshAreas?: boolean
    }) {
        loading.value = true
        error.value = null
        try {
            const params = new URLSearchParams()
            if (options?.mode) params.set("mode", options.mode)
            if (options?.refresh) params.set("refresh", "1")
            if (options?.refreshAreas) params.set("refreshAreas", "1")
            const qs = params.toString()
            const res = await axios.get<UsePlanResponse>(
                `${backendBaseUrl}/aup/useplan${qs ? `?${qs}` : ""}`,
            )
            usePlan.value = res.data
        } catch (e: any) {
            error.value = e?.message || "Failed to load use plan"
            console.error("Failed to load AUP use plan:", e)
        } finally {
            loading.value = false
        }
    }

    async function reloadAupIds() {
        const res = await axios.get(`${backendBaseUrl}/aup/aup-ids/refresh`)
        return res.data
    }

    function topskyDownloadUrl(mode: UsePlanMode = "sectorfile") {
        return `${backendBaseUrl}/aup/aup.txt`
    }

    return {
        usePlan,
        loading,
        error,
        fetchUsePlan,
        reloadAupIds,
        topskyDownloadUrl,
    }
})
