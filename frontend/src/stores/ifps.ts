import useEventBus from "@/eventbus"
import axios from "axios"
import { defineStore } from "pinia"
import { reactive, ref } from "vue"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

type AnyRecord = Record<string, any>

export const useIfpsStore = defineStore("ifps", () => {
    const bus = useEventBus()

    const byCallsign = reactive({} as AnyRecord)
    const byDepAirport = reactive({} as AnyRecord)
    const byArrAirport = reactive({} as AnyRecord)
    const status = reactive({} as AnyRecord)
    const events = reactive({} as any[])

    const loading = ref(false)
    const trackedDepAirports = reactive([] as string[])
    const lastFetchByDepAirport = reactive({} as AnyRecord)

    function trackDepAirport(airport: string) {
        const upper = airport.toUpperCase()
        if (!trackedDepAirports.includes(upper)) trackedDepAirports.push(upper)
    }

    function shouldFetch(cache: AnyRecord, key: string, minAgeMs: number) {
        const last = cache[key]
        if (!last) return true
        return Date.now() - last > minAgeMs
    }

    async function fetchByCallsign(callsign: string) {
        if (!callsign) return
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/cdm/ifps/callsign`, {
                params: { callsign },
            })
            byCallsign[callsign] = res.data
        } catch (error) {
            console.error("Failed to fetch IFPS by callsign", callsign, error)
        } finally {
            loading.value = false
        }
    }

    async function fetchByDepAirport(airport: string, minAgeMs = 30000) {
        if (!airport) return
        const upper = airport.toUpperCase()
        if (!shouldFetch(lastFetchByDepAirport, upper, minAgeMs)) return
        trackDepAirport(upper)
        lastFetchByDepAirport[upper] = Date.now()
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/cdm/ifps/depAirport`, {
                params: { airport: upper },
            })
            byDepAirport[upper] = res.data
        } catch (error) {
            console.error("Failed to fetch IFPS by dep airport", upper, error)
        } finally {
            loading.value = false
        }
    }

    async function fetchByArrAirport(airport: string, minAgeMs = 30000) {
        if (!airport) return
        const upper = airport.toUpperCase()
        if (!shouldFetch(lastFetchByDepAirport, `ARR-${upper}`, minAgeMs)) return
        lastFetchByDepAirport[`ARR-${upper}`] = Date.now()
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/cdm/ifps/arrAirport`, {
                params: { airport: upper },
            })
            byArrAirport[upper] = res.data
        } catch (error) {
            console.error("Failed to fetch IFPS by arr airport", upper, error)
        } finally {
            loading.value = false
        }
    }

    async function fetchStatus(statusQuery?: string) {
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/cdm/ifps/status`, {
                params: statusQuery ? { status: statusQuery } : undefined,
            })
            for (const key in status) delete status[key]
            Object.assign(status, res.data)
        } catch (error) {
            console.error("Failed to fetch IFPS status", error)
        } finally {
            loading.value = false
        }
    }

    async function fetchEvents() {
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/cdm/ifps/events`)
            events.splice(0)
            if (Array.isArray(res.data)) events.push(...res.data)
        } catch (error) {
            console.error("Failed to fetch IFPS events", error)
        } finally {
            loading.value = false
        }
    }

    async function sendDpi(callsign: string, value: string) {
        if (!callsign || !value) return
        try {
            const res = await axios.post(`${backendBaseUrl}/cdm/ifps/dpi`, null, {
                params: { callsign, value },
            })
            return res.data
        } catch (error) {
            console.error("Failed to send IFPS DPI", callsign, value, error)
            throw error
        }
    }

    function findFlightInResult(result: any, callsign: string) {
        if (!result || !callsign) return undefined
        const cs = String(callsign).toUpperCase()
        const match = (r: any) => String(r?.callsign ?? "").toUpperCase() === cs
        if (Array.isArray(result)) return result.find(match)
        if (Array.isArray(result.data)) return result.data.find(match)
        if (Array.isArray(result.flights)) return result.flights.find(match)
        if (typeof result === "object" && match(result)) return result
        return undefined
    }

    function findFlight(callsign: string) {
        if (!callsign) return undefined
        const cs = String(callsign).toUpperCase()
        if (callsign in byCallsign) return byCallsign[callsign]
        for (const key of Object.keys(byCallsign)) {
            if (String(key).toUpperCase() === cs) return byCallsign[key]
        }
        for (const key in byDepAirport) {
            const found = findFlightInResult(byDepAirport[key], callsign)
            if (found) return found
        }
        for (const key in byArrAirport) {
            const found = findFlightInResult(byArrAirport[key], callsign)
            if (found) return found
        }
        return undefined
    }

    if ((window as any).ifpsRefreshInterval) clearInterval((window as any).ifpsRefreshInterval)
    ;(window as any).ifpsRefreshInterval = setInterval(() => {
        if (trackedDepAirports.length === 0) return
        for (const airport of trackedDepAirports) fetchByDepAirport(airport)
    }, 60000)

    bus.on("refresh", () => {
        for (const key in byCallsign) delete byCallsign[key]
        for (const key in byDepAirport) delete byDepAirport[key]
        for (const key in byArrAirport) delete byArrAirport[key]
        trackedDepAirports.splice(0)
    })

    return {
        byCallsign,
        byDepAirport,
        byArrAirport,
        status,
        events,
        loading,
        fetchByCallsign,
        fetchByDepAirport,
        fetchByArrAirport,
        fetchStatus,
        fetchEvents,
        sendDpi,
        findFlight,
    }
})
