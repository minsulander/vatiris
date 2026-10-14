import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import axios from "axios"
import { v4 as uuid } from "uuid"
import moment from "moment"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

export interface EfsColumn {
    id: string
    callsigns: string[]
}

/** Tower/ops values from EFS sync (SEP / DLV / DEP GAP / INFO). */
export interface EfsSepParams {
    sep?: number | string
    dlv?: number | string
    depGap?: number | string
    info?: string
}

export interface EfsLayout {
    source: string
    updatedAt: string
    columns: EfsColumn[]
    sep?: EfsSepParams
    airport: string
    view: string
    efsActive?: boolean
}

export const useEfsStore = defineStore("efs", () => {
    const layouts = reactive({} as { [key: string]: EfsLayout | null })
    const efsActive = reactive({} as { [key: string]: boolean })
    const subscriptions = reactive({} as { [id: string]: string })
    const loading = ref(false)
    /** ISO time of last successful fetch per airport/view. */
    const lastReceivedAt = reactive({} as { [key: string]: string })

    function key(airport: string, view: string) {
        return `${airport.toUpperCase()}/${view.toUpperCase()}`
    }

    function subscribe(airport: string, view: string) {
        const subscriptionId = uuid()
        const k = key(airport, view)
        subscriptions[subscriptionId] = k
        if (!(k in layouts)) fetch(airport, view)
        return subscriptionId
    }

    function unsubscribe(subscriptionId: string) {
        delete subscriptions[subscriptionId]
    }

    async function fetch(airport: string, view: string) {
        const k = key(airport, view)
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/efs/${airport}/${view}`)
            layouts[k] = res.data
            efsActive[k] = !!res.data?.efsActive
            lastReceivedAt[k] = moment.utc().toISOString()
        } catch {
            layouts[k] = null
            efsActive[k] = false
        } finally {
            loading.value = false
        }
    }

    function isActive(airport: string, view: string) {
        return !!efsActive[key(airport, view)]
    }

    function getLayout(airport: string, view: string) {
        return layouts[key(airport, view)] || null
    }

    /** Newest of layout.updatedAt and last successful receive for this bay. */
    function latestDataTime(airport: string, view: string): string | null {
        const k = key(airport, view)
        const layout = layouts[k]
        const candidates: moment.Moment[] = []
        if (layout?.updatedAt) {
            const m = moment.utc(layout.updatedAt)
            if (m.isValid()) candidates.push(m)
        }
        if (lastReceivedAt[k]) {
            const m = moment.utc(lastReceivedAt[k])
            if (m.isValid()) candidates.push(m)
        }
        if (!candidates.length) return null
        return moment.max(...candidates).toISOString()
    }

    if ((window as any).efsRefreshInterval) clearInterval((window as any).efsRefreshInterval)
    ;(window as any).efsRefreshInterval = setInterval(() => {
        const keys = new Set(Object.values(subscriptions))
        for (const k of keys) {
            const [airport, view] = k.split("/")
            if (airport && view) fetch(airport, view)
        }
    }, 5000)

    return {
        layouts,
        efsActive,
        lastReceivedAt,
        loading,
        subscribe,
        unsubscribe,
        fetch,
        isActive,
        getLayout,
        latestDataTime,
    }
})
