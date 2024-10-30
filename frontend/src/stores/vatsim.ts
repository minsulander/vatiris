import axios from "axios"
import moment from "moment"
import { defineStore } from "pinia"
import { computed, reactive, ref } from "vue"
import { atisAirports } from "@/metcommon"

const apiBaseUrl = "https://api.vatiris.se"

export interface Controller {
    callsign: string
    cid: number
    facility: number
    frequency: string
    last_updated: string
    logon_time: string
    name: string
    rating: number
    server: string
    text_atis?: string[]
    visual_range: number
}

export interface Atis extends Controller {
    atis_code: string
}

export interface Facility {
    id: number
    long: string
    short: string
}

export interface PilotRating {
    id: number
    short_name: string
    long_name: string
}

export interface Rating {
    id: number
    short: string
    long: string
}

export interface GeneralData {
    version: number
    reload: number
    unique_users: number
    update: string
    update_timestamp: string
    connected_clients: number
}

export interface FlightPlan {
    aircraft: string
    aircraft_faa: string
    aircraft_short: string
    alternate: string
    altitude: string
    arrival: string
    assigned_transponder: string
    cruise_tas: string
    departure: string
    deptime: string
    enroute_time: string
    flight_rules: string
    fuel_time: string
    remarks: string
    revision_id: number
    route: string
}

export interface Pilot {
    altitude: number
    callsign: string
    cid: number
    flight_plan: FlightPlan
    groundspeed: number
    heading: number
    last_updated: string
    latitude: number
    logon_time: string
    longitude: number
    military_rating: number
    name: string
    pilot_rating: number
    qnh_i_hg: number
    qnh_mb: number
    server: string
    transponder: string
}

export interface Prefile {
    callsign: string
    cid: number
    flight_plan: FlightPlan
    last_updated: string
    name: string
}

export interface VatsimData {
    atis: Atis[]
    controllers: Controller[]
    facilities: Facility[]
    general: GeneralData
    military_ratings: PilotRating[]
    pilot_ratings: PilotRating[]
    pilots: Pilot[]
    prefiles: Prefile[]
    ratings: Rating[]
    // servers
}

export interface Country {
    name: string
    prefix: string
    facility: string
}

export interface Airport {
    icao: string
    iata: string
    name: string
    latitude: number
    longitude: number
    fir: string
    pseudo: boolean
}

export interface FIR {
    icao: string
    name: string
    callsignPrefix: string
    firBoundary: string
}

export interface UIR {
    id: string
    name: string
    firBoundaries: string[]
}

export const useVatsimStore = defineStore("vatsim", () => {
    const data = ref({} as VatsimData)
    const airportByIcao = ref({} as { [key: string]: Airport })
    const timeUntilRefresh = ref(0)
    const refreshing = ref(0)

    const refreshInterval = computed(() => 30000) // TODO lower interval when logged in

    const atisTime = (icao: string) => {
        if (!data.value || !data.value.atis) return undefined
        const atis = data.value.atis.find((a) => a.callsign.startsWith(icao))
        if (atis && atis.text_atis && atis.text_atis.length > 0) {
            const m = atis.text_atis.join(" ").match(/TIME (\d{4})Z/)
            if (m && m[1]) return parseInt(m[1])
        }
        return undefined
    }
    const atisQnh = (icao: string) => {
        if (!data.value || !data.value.atis) return undefined
        const atis = data.value.atis.find((a) => a.callsign.startsWith(icao))
        if (atis && atis.text_atis && atis.text_atis.length > 0) {
            const m = atis.text_atis.join(" ").match(/QNH (\d{4})/)
            if (m && m[1]) return parseInt(m[1])
        }
        return undefined
    }
    const lastQnh = reactive({} as { [key: string]: number })

    const qnhTrend = (icao: string) => {
        const q = atisQnh(icao)
        if (q && icao in lastQnh) return q - lastQnh[icao]
        return undefined
    }

    async function fetchData() {
        refreshing.value++
        try {
            const startRequest = new Date().getTime()
            const response = await axios.get(`${apiBaseUrl}/data`)
            const previousAtisTime = {} as { [key: string]: number }
            const previousAtisQnh = {} as { [key: string]: number }
            for (const icao of atisAirports) {
                if (!atisTime(icao) || !atisQnh(icao)) continue
                previousAtisTime[icao] = atisTime(icao)!
                previousAtisQnh[icao] = atisQnh(icao)!
            }
            if (response.data.general && response.data.general.update_timestamp && data.value.general && data.value.general.update_timestamp && response.data.general.update_timestamp == data.value.general?.update_timestamp) {
                console.warn(`Got VATSIM data in ${(new Date().getTime() - startRequest).toFixed()} ms but it has the same general.update_timestamp`)
            } else {
                console.log(`Got VATSIM data in ${(new Date().getTime() - startRequest).toFixed()} ms`)
            }
            data.value = response.data as VatsimData
            for (const icao of atisAirports) {
                if (atisTime(icao) && icao in previousAtisTime && atisTime(icao) != previousAtisTime[icao]) {
                    console.log(`  ATIS updated for ${icao}`)
                    if (icao in previousAtisQnh) lastQnh[icao] = previousAtisQnh[icao]
                }
            }
        } finally {
            refreshing.value--
        }
    }

    if (!(window as any).refreshInterval) {
        (window as any).refreshInterval = setInterval(() => {
            timeUntilRefresh.value -= 500
            if (timeUntilRefresh.value > refreshInterval.value) timeUntilRefresh.value = refreshInterval.value
            if (timeUntilRefresh.value <= 0) {
                timeUntilRefresh.value = refreshInterval.value
                if (document.visibilityState == "visible") {
                    fetchData()
                } else {
                    console.log("Not refreshing - not visible")
                }
            }
        }, 500)
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState == "visible") {
                if (
                    !data.value.general ||
                    !data.value.general.update_timestamp ||
                    moment(data.value.general.update_timestamp).isBefore(moment().add(-refreshInterval.value, "millisecond"))
                ) {
                    if (refreshing.value > 0) {
                        console.log("Became visible with outdated data but already refreshing")
                    } else {
                        console.log("Became visible with outdated data - refresh")
                        timeUntilRefresh.value = 0
                    }
                }
            }
        })
    }

    return {
        data,
        airportByIcao,
        refreshInterval,
        timeUntilRefresh,
        refreshing,
        atisTime,
        atisQnh,
        lastQnh,
        qnhTrend,
        fetchData,
    }
})
