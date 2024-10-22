import { defineStore } from "pinia"
import { reactive } from "vue"
import { v4 as uuid } from "uuid"
import axios from "axios"
import useEventBus from "@/eventbus"
import { parseMetar } from "metar-taf-parser"

export const useMetarStore = defineStore("metar", () => {
    const bus = useEventBus()

    const metar = reactive({} as { [key: string]: string })
    const subscriptions = reactive({} as { [key: string]: string })
    const lastFetch = reactive({} as { [key: string]: Date })

    const parse = (icao: string) => (icao in metar ? parseMetar(metar[icao]) : undefined)

    function subscribe(icao: string) {
        const subscriptionId = uuid()
        subscriptions[subscriptionId] = icao
        if (!(icao in metar)) fetch(icao)
        return subscriptionId
    }

    function unsubscribe(subscription: string) {
        if (subscription in subscriptions) {
            const icao = subscriptions[subscription]
            delete subscriptions[subscription]
            if (!Object.values(subscriptions).includes(icao)) {
                delete metar[icao]
                delete lastFetch[icao]
            }
        }
    }

    // TODO fetch all at once

    function fetch(icao: string) {
        if (!(icao in metar)) metar[icao] = "Loading..."
        lastFetch[icao] = new Date()
        console.log(`Fetch metar ${icao}`)
        axios.get(`https://api.vatiris.se/metar?ids=${icao}`).then((response) => {
            metar[icao] = response.data
            lastFetch[icao] = new Date()
        })
    }

    if ((window as any).metarRefreshInterval) clearInterval((window as any).metarRefreshInterval)
    ;(window as any).metarRefreshInterval = setInterval(() => {
        for (const icao in lastFetch) {
            if (new Date().getTime() - lastFetch[icao].getTime() > 60000) fetch(icao)
        }
    }, 1000)

    function refresh() {
        for (const icao in metar) delete metar[icao]
        for (const icao in metar) delete lastFetch[icao]
        for (const id in subscriptions) fetch(subscriptions[id])
    }

    bus.on("refresh", () => refresh())

    return {
        metar,
        parse,
        subscribe,
        unsubscribe,
        fetch,
        refresh,
    }
})
