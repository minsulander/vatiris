import useEventBus from "@/eventbus"
import { v4 as uuid } from "uuid"
import axios from "axios"
import { defineStore } from "pinia"
import { reactive, ref } from "vue"
const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

export const useEsdataStore = defineStore("esdata", () => {
    const bus = useEventBus()

    const data = reactive({} as any)
    const subscriptions = reactive([] as string[])
    const loading = ref(false)

    const statusLabel = {
        PRE: "PRE",
        STAT: "STA",
        INVFP: "IFP",
        NOFP: "NFP",
        NOFDP: "NFD",
        ONFREQ: "FRQ",
        "DE-ICE": "REA",
        STUP: "S/U",
        PUSH: "S/P",
        TAXI: "TXO",
        LINEUP: "xLU",
        DEPA: "xTO",
        ARR: "ARR",
        LAND: "LAN",
        TXIN: "TXI",
        PARK: "PRK",
    } as { [key: string]: string }

    const statusDescription = {
        PRE: "Prefiled",
        STAT: "Stationary",
        INVFP: "Invalid flightplan",
        NOFP: "No flightplan",
        NOFDP: "No flight data",
        ONFREQ: "On frequency",
        "DE-ICE": "Ready",
        STUP: "Startup",
        PUSH: "Startup/Pushback",
        TAXI: "Taxi out",
        LINEUP: "Line up",
        DEPA: "Takeoff",
        ARR: "Arriving",
        LAND: "Landed",
        TXIN: "Taxi in",
        PARK: "Parked",
    } as { [key: string]: string }

    const statusOrder = {
        PRE: -5,
        STAT: -4,
        INVFP: -3,
        NOFP: -2,
        NOFDP: -1,
        ONFREQ: 1,
        "DE-ICE": 2,
        STUP: 3,
        PUSH: 4,
        TAXI: 5,
        LINEUP: 6,
        DEPA: 7,
        ARR: 8,
        LAND: 9,
        TXIN: 10,
        PARK: 11,
    } as { [key: string]: number }

    function subscribe() {
        const subscriptionId = uuid()
        subscriptions.push(subscriptionId)
        if (Object.keys(data).length == 0 && !loading.value) fetch()
        return subscriptionId
    }

    function unsubscribe(subscription: string) {
        const index = subscriptions.indexOf(subscription)
        if (index !== -1) subscriptions.splice(index, 1)
    }

    async function fetch() {
        loading.value = true
        try {
            const res = await axios.get(`${backendBaseUrl}/esdata`)
            for (const key in data) delete data[key]
            Object.assign(data, res.data)
            loading.value = false
            //console.log("Got ES data")
        } catch (error) {
            console.error("Failed to fetch esdata", error)
            loading.value = false
        }
    }

    if ((window as any).esdataRefreshInterval) clearInterval((window as any).esdataRefreshInterval)
    ;(window as any).esdataRefreshInterval = setInterval(() => {
        if (subscriptions.length > 0) fetch()
    }, 15000)

    function refresh() {
        for (const key in data) delete data[key]
        if (subscriptions.length > 0) fetch()
    }

    bus.on("refresh", () => refresh())

    return {
        data,
        loading,
        statusLabel,
        statusDescription,
        statusOrder,
        subscribe,
        unsubscribe,
        fetch,
    }
})
