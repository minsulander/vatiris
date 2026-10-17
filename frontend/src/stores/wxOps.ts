import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import axios from "axios"
import { v4 as uuid } from "uuid"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

export interface WxOpsScc {
    runway: string
    matchedKey: string
    closed: boolean
    thirds: number[] | null
    issuedAt: string | null
    remark: string | null
    raw: string
}

export interface WxOps {
    icao: string
    observedAt: string | null
    runwayInUse: { arr: string | null; dep: string | null }
    flightCategory: "VMC" | "IMC"
    wxAdaptation: {
        label: "VMC" | "IMC"
        cavok: boolean
        lowVisibility: boolean
        rvrRelevant: boolean
        ceilingFt: number | null
        visibilityM: number | null
    }
    scc: WxOpsScc | null
    sccAll: WxOpsScc[]
    metar: string | null
}

export const useWxOpsStore = defineStore("wxOps", () => {
    const ops = reactive({} as { [key: string]: WxOps | null })
    const subscriptions = reactive({} as { [id: string]: string })
    const loading = ref(false)

    function cacheKey(icao: string, runway?: string) {
        return runway ? `${icao.toUpperCase()}:${runway.toUpperCase()}` : icao.toUpperCase()
    }

    function subscribe(icao: string, runway?: string) {
        const subscriptionId = uuid()
        const k = cacheKey(icao, runway)
        subscriptions[subscriptionId] = k
        if (!(k in ops)) fetch(icao, runway)
        return subscriptionId
    }

    function unsubscribe(subscriptionId: string) {
        delete subscriptions[subscriptionId]
    }

    async function fetch(icao: string, runway?: string) {
        const k = cacheKey(icao, runway)
        loading.value = true
        try {
            const params = runway ? `?runway=${encodeURIComponent(runway)}` : ""
            const res = await axios.get(`${backendBaseUrl}/wx/${icao}/ops${params}`)
            ops[k] = res.data
        } catch (e) {
            console.error("wxOps fetch failed", e)
            ops[k] = null
        } finally {
            loading.value = false
        }
    }

    function get(icao: string, runway?: string) {
        return ops[cacheKey(icao, runway)] || null
    }

    if ((window as any).wxOpsRefreshInterval) clearInterval((window as any).wxOpsRefreshInterval)
    ;(window as any).wxOpsRefreshInterval = setInterval(() => {
        const keys = new Set(Object.values(subscriptions))
        for (const k of keys) {
            const [icao, runway] = k.split(":")
            if (icao) fetch(icao, runway)
        }
    }, 60000)

    return { ops, loading, subscribe, unsubscribe, fetch, get }
})
