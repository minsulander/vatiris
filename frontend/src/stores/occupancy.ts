import useEventBus from "@/eventbus"
import axios from "axios"
import moment from "moment"
import { defineStore } from "pinia"
import { v4 as uuid } from "uuid"
import { computed, reactive, ref } from "vue"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

export const useOccupancyStore = defineStore("occupancy", () => {
    const bus = useEventBus()

    const occupancy = reactive({} as any)
    const subscriptions = reactive([] as string[])

    function subscribe() {
        const subscriptionId = uuid()
        subscriptions.push(subscriptionId)
        if (Object.keys(occupancy).length == 0) fetch()
        return subscriptionId
    }

    function unsubscribe(subscription: string) {
        const index = subscriptions.indexOf(subscription)
        if (index !== -1) subscriptions.splice(index, 1)
    }

    function fetch() {
        axios
            .get(`${backendBaseUrl}/fdp/occupancy.json`)
            .then((response) => {
                for (const key in occupancy) delete occupancy[key]
                Object.assign(occupancy, response.data)
                console.log(`Got occupancy`)
            })
            .catch((error) => {
                console.error("Failed to fetch occupancy", error)
            })
    }

    if ((window as any).occupancyRefreshInterval) clearInterval((window as any).occupancyRefreshInterval)
    ;(window as any).occupancyRefreshInterval = setInterval(() => {
        if (subscriptions.length > 0) fetch()
    }, 60000)

    function refresh() {
        for (const key in occupancy) delete occupancy[key]
        if (subscriptions.length > 0) fetch()
    }

    bus.on("refresh", () => refresh())

    return {
        occupancy,
        subscribe,
        unsubscribe,
        fetch,
    }
})
