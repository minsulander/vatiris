import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import { v4 as uuid } from "uuid"
import axios from "axios"
import useEventBus from "@/eventbus"
import { parseMetar } from "metar-taf-parser"

export const metarAirports = [
    "ESCF",
    "ESCM",
    "ESDF",
    "ESGG",
    "ESGJ",
    "ESGT",
    "ESGP",
    "ESIA",
    "ESIB",
    "ESKM",
    "ESKN",
    "ESKS",
    "ESMK",
    "ESMQ",
    "ESMS",
    "ESMT",
    "ESMX",
    "ESND",
    "ESNG",
    "ESNK",
    "ESNL",
    "ESNN",
    "ESNO",
    "ESNQ",
    "ESNS",
    "ESNU",
    "ESNV",
    "ESNX",
    "ESNZ",
    "ESOE",
    "ESOK",
    "ESOH",
    "ESOW",
    "ESPA",
    "ESPE",
    "ESSA",
    "ESSB",
    "ESSD",
    "ESSL",
    "ESSP",
    "ESST",
    "ESSV",
    "ESTA",
    "ESTL",
    "ESUP",
    "ESUT",
]

export const useMetarStore = defineStore("metar", () => {
    const bus = useEventBus()

    const metar = reactive({} as { [key: string]: string })
    const history = reactive({} as { [key: string]: string[] })
    const subscriptions = reactive({} as { [key: string]: string })
    const lastFetch = ref(0)

    const parse = (icao: string) => (icao in metar ? parseMetar(metar[icao]) : undefined)

    const qnhTrend = (icao: string) => {
        if (!(icao in metar)) return undefined
        const cm = metar[icao].match(/Q(\d{4})/)
        if (!cm || !cm[1] || !isFinite(parseInt(cm[1]))) return undefined
        const current = parseInt(cm[1])
        for (const line of history[icao]) {
            const m = line.match(/Q(\d{4})/)
            if (!m || !m[1] || !isFinite(parseInt(m[1]))) continue
            const qnh = parseInt(m[1])
            if (qnh != current) return current - qnh
        }
        return 0
    }

    let fetchOnSubscribeTimeout: any = undefined
    function subscribe(icao: string) {
        const subscriptionId = uuid()
        subscriptions[subscriptionId] = icao
        if (!(icao in metar)) {
            metar[icao] = `${icao} Loading...`
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
        const airports = [...new Set(Object.values(subscriptions))]
        const icaos = airports.join(",")
        console.log(`Fetch metar`, icaos)
        axios.get(`https://api.vatiris.se/metar?ids=${icaos}&hours=6&sep=true`).then((response) => {
            for (const section of (response.data as string).split("\n\n")) {
                let first = true
                for (const line of section.trim().split("\n")) {
                    const icao = line.split(" ")[0]
                    if (first) {
                        metar[icao] = line
                        history[icao] = []
                        first = false
                    } else {
                        history[icao].push(line)
                    }
                }
            }
            for (const icao of airports) {
                if (metar[icao] && metar[icao].includes("Loading")) metar[icao] = ""
            }
            lastFetch.value = Date.now()
        })
    }

    if ((window as any).metarRefreshInterval) clearInterval((window as any).metarRefreshInterval)
    ;(window as any).metarRefreshInterval = setInterval(() => {
        if (Date.now() - lastFetch.value > 180000) fetch()
    }, 1000)

    function refresh() {
        for (const icao in metar) metar[icao] = `${icao} Loading...`
        setTimeout(fetch, 200)
    }

    bus.on("refresh", () => refresh())

    return {
        metar,
        history,
        parse,
        qnhTrend,
        subscribe,
        unsubscribe,
        fetch,
        refresh,
    }
})
