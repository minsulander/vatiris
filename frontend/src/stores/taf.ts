import { defineStore } from "pinia"
import { reactive } from "vue"
import { v4 as uuid } from "uuid"
import axios from "axios"
import useEventBus from "@/eventbus"
import { parseTAF } from "metar-taf-parser"

export const useTafStore = defineStore("taf", () => {
    const bus = useEventBus()

    const taf = reactive({} as { [key: string]: string })
    const subscriptions = reactive({} as { [key: string]: string })
    const lastFetch = reactive({} as { [key: string]: Date })

    const parse = (icao: string) => (icao in taf ? parseTAF(taf[icao]) : undefined)

    function subscribe(icao: string) {
        const subscriptionId = uuid()
        subscriptions[subscriptionId] = icao
        if (!(icao in taf)) fetch(icao)
        return subscriptionId
    }

    function unsubscribe(subscription: string) {
        if (subscription in subscriptions) {
            const icao = subscriptions[subscription]
            delete subscriptions[subscription]
            if (!Object.values(subscriptions).includes(icao)) {
                delete taf[icao]
                delete lastFetch[icao]
            }
        }
    }

    // TODO fetch all at once

    function fetch(icao: string) {
        if (!(icao in taf)) taf[icao] = "Loading..."
        lastFetch[icao] = new Date()
        console.log(`Fetch taf ${icao}`)
        axios.get(`https://api.vatiris.se/taf?ids=${icao}`).then((response) => {
            taf[icao] = response.data
            lastFetch[icao] = new Date()
        })
    }

    if ((window as any).tafRefreshInterval) clearInterval((window as any).tafRefreshInterval)
    ;(window as any).tafRefreshInterval = setInterval(() => {
        for (const icao in lastFetch) {
            if (new Date().getTime() - lastFetch[icao].getTime() > 60000) fetch(icao)
        }
    }, 1000)

    function refresh() {
        for (const icao in taf) delete taf[icao]
        for (const icao in taf) delete lastFetch[icao]
        for (const id in subscriptions) fetch(subscriptions[id])
    }

    bus.on("refresh", () => refresh())

    return {
        taf,
        parse,
        subscribe,
        unsubscribe,
        fetch,
        refresh,
    }
})
