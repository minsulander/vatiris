import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import { v4 as uuid } from "uuid"
import axios from "axios"
import useEventBus from "@/eventbus"
import moment from "moment"
import { useMetarStore } from "./metar"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

interface SmhiData {
    temperature?: number
    dewpoint?: number
    qnh?: number  // QNH in hPa, may include decimal
    humidity?: number  // Relative humidity in percent
    visibility?: number  // Visibility in meters
    timestamp?: string
}

export const useSmhiStore = defineStore("smhi", () => {
    const bus = useEventBus()
    const metarStore = useMetarStore()

    const time = ref("")
    const smhiData = reactive({} as { [key: string]: SmhiData })
    const subscriptions = reactive({} as { [key: string]: string })
    const lastFetch = reactive({} as { [key: string]: Date })

    // Fetch temperature and dewpoint from SMHI API
    // For now, fallback to METAR data if SMHI API not available
    async function fetch(icao: string) {
        if (!icao) return

        lastFetch[icao] = new Date()
        
        try {
            // Try fetching from backend proxy first
            try {
                const response = await axios.get(`${backendBaseUrl}/smhi?icao=${icao}`)
                if (response.data && (response.data.temperature !== undefined || response.data.dewpoint !== undefined)) {
                    smhiData[icao] = {
                        temperature: response.data.temperature,
                        dewpoint: response.data.dewpoint,
                        qnh: response.data.qnh,
                        humidity: response.data.humidity,
                        visibility: response.data.visibility,
                        timestamp: response.data.timestamp || moment().utc().toISOString(),
                    }
                    time.value = smhiData[icao].timestamp || moment().utc().toISOString()
                    lastFetch[icao] = new Date()
                    return
                }
            } catch (e: any) {
                // Backend endpoint returns 404 if SMHI data not yet available (normal, triggers METAR fallback)
                // Only log non-404 errors (network issues, server errors, etc.)
                if (e.response?.status !== 404) {
                    // Suppress CORS and network errors in console unless they're unexpected
                    if (e.code === 'ERR_NETWORK' || e.message?.includes('CORS')) {
                        // These are expected if endpoint isn't deployed yet or CORS not configured
                        // Silent fallback to METAR
                    } else {
                        console.log(`SMHI API error for ${icao}:`, e.message)
                    }
                }
                // Fall through to METAR fallback
            }
            
            // No SMHI API data available - temperature and dewpoint must come from SMHI API
            // Don't use METAR fallback as component requires SMHI API data only
            smhiData[icao] = {
                timestamp: moment().utc().toISOString(),
            }
        } catch (error: any) {
            console.error(`Error fetching SMHI data for ${icao}:`, error)
            smhiData[icao] = {
                timestamp: moment().utc().toISOString(),
            }
        }
    }
    
    // Note: No METAR watch needed since we only use SMHI API data for temperature/dewpoint

    function subscribe(icao: string) {
        const subscriptionId = uuid()
        subscriptions[subscriptionId] = icao
        // Also ensure METAR is available for fallback
        metarStore.subscribe(icao)
        if (!(icao in smhiData)) {
            smhiData[icao] = {}
        }
        fetch(icao)
        return subscriptionId
    }

    function unsubscribe(subscription: string) {
        if (subscription in subscriptions) {
            const icao = subscriptions[subscription]
            delete subscriptions[subscription]
            if (!Object.values(subscriptions).includes(icao)) {
                delete smhiData[icao]
                delete lastFetch[icao]
                // Note: We don't unsubscribe from METAR here because other components might use it
            }
        }
    }

    // Auto-refresh interval
    if ((window as any).smhiRefreshInterval) clearInterval((window as any).smhiRefreshInterval)
    ;(window as any).smhiRefreshInterval = setInterval(() => {
        for (const icao in lastFetch) {
            if (new Date().getTime() - lastFetch[icao].getTime() > 3600000) {
                // Refresh every hour
                fetch(icao)
            }
        }
    }, 60000) // Check every minute

    function refresh() {
        for (const icao in smhiData) delete smhiData[icao]
        for (const icao in smhiData) delete lastFetch[icao]
        for (const id in subscriptions) fetch(subscriptions[id])
    }

    bus.on("refresh", () => refresh())

    return {
        smhiData,
        time,
        subscribe,
        unsubscribe,
        fetch,
        refresh,
    }
})

