import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import { v4 as uuid } from "uuid"
import axios from "axios"
import useEventBus from "@/eventbus"
import { parseTAF } from "metar-taf-parser"

export const useTafStore = defineStore("taf", () => {
    const bus = useEventBus()

    const taf = reactive({} as { [key: string]: string })
    const subscriptions = reactive({} as { [key: string]: string })
    const lastFetch = ref(0)

    const parse = (icao: string) => (icao in taf ? parseTAF(taf[icao]) : undefined)

    let fetchOnSubscribeTimeout: any = undefined
    function subscribe(icao: string) {
        const subscriptionId = uuid()
        subscriptions[subscriptionId] = icao
        if (!(icao in taf)) {
            taf[icao] = `TAF ${icao} Loading...`
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
                delete taf[icao]
            }
        }
    }

    function fetch() {
        if (Object.values(subscriptions).length == 0) return
        lastFetch.value = Date.now()
        const airports = [...new Set(Object.values(subscriptions))]
        const icaos = airports.join(",")
        console.log(`Fetch taf`, icaos)
        axios.get(`https://api.vatiris.se/taf?ids=${icaos}`).then((response) => {
            let text = ""

            function processTextSoFar() {
                const m = text.match(/^TAF( AMD| COR| CORR)? (\w{4})/)
                if (m && m[2]) {
                    const icao = m[2]
                    taf[icao] = text
                    text = ""
                }
            }

            for (const line of (response.data as string).split(/\n+/)) {
                if (line.startsWith("TAF") && text.length > 0) processTextSoFar()
                text += line + "\n"
            }
            if (text.length > 0) processTextSoFar()

            for (const icao of airports) {
                if (taf[icao] && taf[icao].includes("Loading")) taf[icao] = ""
            }
            lastFetch.value = Date.now()
        })
    }

    if ((window as any).tafRefreshInterval) clearInterval((window as any).tafRefreshInterval)
    ;(window as any).tafRefreshInterval = setInterval(() => {
        if (Date.now() - lastFetch.value > 600000) fetch()
    }, 1000)

    function refresh() {
        for (const icao in taf) taf[icao] = `TAF ${icao} Loading...`
        setTimeout(fetch, 300)
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
