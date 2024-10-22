import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import { v4 as uuid } from "uuid"
import axios from "axios"
import useEventBus from "@/eventbus"
import { parseMetar } from "metar-taf-parser"

export const useMetarStore = defineStore("metar", () => {
    const bus = useEventBus()

    const metar = reactive({} as { [key: string]: string })
    const subscriptions = reactive({} as { [key: string]: string })
    const lastFetch = ref(0)

    const parse = (icao: string) => (icao in metar ? parseMetar(metar[icao]) : undefined)

    let fetchOnSubscribeTimeout: any = undefined
    function subscribe(icao: string) {
        const subscriptionId = uuid()
        subscriptions[subscriptionId] = icao
        if (!(icao in metar)) {
            metar[icao] = "Loading..."
            if (fetchOnSubscribeTimeout) clearTimeout(fetchOnSubscribeTimeout)
            fetchOnSubscribeTimeout = setTimeout(() => {
                fetchOnSubscribeTimeout = undefined
                fetch()
            }, 500)
        }
        return subscriptionId
    }

    function unsubscribe(subscription: string) {
        if (subscription in subscriptions) {
            const icao = subscriptions[subscription]
            delete subscriptions[subscription]
            if (!Object.values(subscriptions).includes(icao)) {
                delete metar[icao]
            }
        }
    }

    function fetch() {
        if (Object.values(subscriptions).length == 0) return
        lastFetch.value = Date.now()
        const icaos = [...new Set(Object.values(subscriptions))].join(",")
        console.log(`Fetch metars`, icaos)
        axios.get(`https://api.vatiris.se/metar?ids=${icaos}&hours=6&sep=true`).then((response) => {
            for (const section of (response.data as string).split("\n\n")) {
                for (const line of section.trim().split("\n")) {
                    const icao = line.split(" ")[0]
                    metar[icao] = line
                    break // TODO use the other lines to determine QNH trend
                }
            }
            lastFetch.value = Date.now()
        })
    }

    if ((window as any).metarRefreshInterval) clearInterval((window as any).metarRefreshInterval)
    ;(window as any).metarRefreshInterval = setInterval(() => {
        if (Date.now() - lastFetch.value > 300000) fetch()
    }, 1000)

    function refresh() {
        for (const icao in metar) delete metar[icao]
        fetch()
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
