import useEventBus from "@/eventbus"
import axios from "axios"
import moment from "moment"
import { defineStore } from "pinia"
import { v4 as uuid } from "uuid"
import { computed, reactive, ref } from "vue"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

export const useFdpStore = defineStore("fdp", () => {
    const bus = useEventBus()

    const fdp = reactive({} as any)
    const geo = reactive({} as any)
    const subscriptions = reactive([] as string[])

    function subscribe() {
        const subscriptionId = uuid()
        subscriptions.push(subscriptionId)
        if (!("general" in fdp)) fetch()
        return subscriptionId
    }

    function unsubscribe(subscription: string) {
        const index = subscriptions.indexOf(subscription)
        if (index !== -1) subscriptions.splice(index, 1)
    }

    function fetch() {
        fdp.loading = true
        Promise.all([
            axios.get(`${backendBaseUrl}/fdp/fdp.json`).then((response) => {
                for (const key in fdp) delete fdp[key]
                Object.assign(fdp, response.data)
                fdp.loading = false
                console.log(`Got FDP data ${fdp.general.update_timestamp}`)
            }),
            axios.get(`${backendBaseUrl}/fdp/fdp.geojson`).then((response) => {
                for (const key in geo) delete geo[key]
                Object.assign(geo, response.data)
                console.log(`Got FDP geojson data`)
            }),
        ]).catch((error) => {
            console.error("Failed to fetch FDP data", error)
        })
    }

    if ((window as any).fdpRefreshInterval) clearInterval((window as any).fdpRefreshInterval)
    ;(window as any).fdpRefreshInterval = setInterval(() => {
        if (subscriptions.length > 0) fetch()
    }, 60000)

    function refresh() {
        for (const key in fdp) delete fdp[key]
        if (subscriptions.length > 0) fetch()
    }

    bus.on("refresh", () => refresh())

    return {
        fdp,
        geo,
        subscribe,
        unsubscribe,
        fetch,
        refresh,
    }
})
