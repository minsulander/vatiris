import useEventBus from "@/eventbus"
import axios from "axios"
import { defineStore } from "pinia"
import { reactive, ref } from "vue"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

type AnyRecord = Record<string, any>

export const useEtfmsStore = defineStore("etfms", () => {
    const bus = useEventBus()

    const airspaces = reactive({} as AnyRecord)
    const airports = reactive({} as AnyRecord)
    const restrictions = reactive({} as AnyRecord)
    const restricted = reactive({} as AnyRecord)
    const trafficVolumes = reactive({} as AnyRecord)
    const scenarios = reactive({} as AnyRecord)

    const loading = ref(false)

    async function fetchAirspaces() {
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/cdm/etfms/airspaces`)
            for (const key in airspaces) delete airspaces[key]
            Object.assign(airspaces, res.data)
        } catch (error) {
            console.error("Failed to fetch ETFMS airspaces", error)
        } finally {
            loading.value = false
        }
    }

    async function fetchAirports() {
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/cdm/etfms/airports`)
            for (const key in airports) delete airports[key]
            Object.assign(airports, res.data)
        } catch (error) {
            console.error("Failed to fetch ETFMS airports", error)
        } finally {
            loading.value = false
        }
    }

    async function fetchRestrictions(type?: string) {
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/cdm/etfms/restrictions`, {
                params: type ? { type } : undefined,
            })
            for (const key in restrictions) delete restrictions[key]
            Object.assign(restrictions, res.data)
        } catch (error) {
            console.error("Failed to fetch ETFMS restrictions", error)
        } finally {
            loading.value = false
        }
    }

    async function fetchRestricted() {
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/cdm/etfms/restricted`)
            for (const key in restricted) delete restricted[key]
            Object.assign(restricted, res.data)
        } catch (error) {
            console.error("Failed to fetch ETFMS restricted airspaces", error)
        } finally {
            loading.value = false
        }
    }

    async function fetchTrafficVolumes(active?: boolean) {
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/cdm/etfms/trafficVolumes`, {
                params: typeof active === "boolean" ? { active } : undefined,
            })
            for (const key in trafficVolumes) delete trafficVolumes[key]
            Object.assign(trafficVolumes, res.data)
        } catch (error) {
            console.error("Failed to fetch ETFMS traffic volumes", error)
        } finally {
            loading.value = false
        }
    }

    async function fetchScenarios(active?: boolean) {
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/cdm/etfms/scenarios`, {
                params: typeof active === "boolean" ? { active } : undefined,
            })
            for (const key in scenarios) delete scenarios[key]
            Object.assign(scenarios, res.data)
        } catch (error) {
            console.error("Failed to fetch ETFMS scenarios", error)
        } finally {
            loading.value = false
        }
    }

    bus.on("refresh", () => {
        for (const key in airspaces) delete airspaces[key]
        for (const key in airports) delete airports[key]
        for (const key in restrictions) delete restrictions[key]
        for (const key in restricted) delete restricted[key]
        for (const key in trafficVolumes) delete trafficVolumes[key]
        for (const key in scenarios) delete scenarios[key]
    })

    return {
        airspaces,
        airports,
        restrictions,
        restricted,
        trafficVolumes,
        scenarios,
        loading,
        fetchAirspaces,
        fetchAirports,
        fetchRestrictions,
        fetchRestricted,
        fetchTrafficVolumes,
        fetchScenarios,
    }
})
