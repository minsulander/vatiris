import { defineStore } from "pinia"
import { reactive, watch } from "vue"
import { v4 as uuid } from "uuid"
import axios from "axios"
import useEventBus from "@/eventbus"

const viewIdByIcao: { [key: string]: string } = {
    ESSA: "arlanda-overview.html",
    ESSB: "bromma-overview.html",
    ESNL: "lycksele-overview.html",
    ESKM: "mora-overview.html",
    ESUP: "pajala-overview.html",
    ESMX: "vaxjo-overview.html",
    ESND: "sveg-overview.html",
    ESGT: "trollhattan-overview.html",
    ESGG: "landvetter-overview.html",
    ESSL: "saab-overview.html",
    ESMS: "sturup-overview.html",
    ESOW: "vasteras-overview.html",
    ESOH: "hagfors-overview.html",
    ESNX: "arvidsjaur-overview.html",
    ESNK: "kramfors-overview.html",
    ESMQ: "kalmar-overview.html",
    ESNV: "vilhelmina-overview.html",
    ESMK: "kristianstad-overview.html",
    ESOE: "orebro-overview.html",
    ESOK: "karlstad-overview.html",
    ESNG: "gallivare-overview.html",
    ESKN: "skavsta-overview.html",
    ESGJ: "jonkoping-overview.html",
}

export const useWxStore = defineStore("wx", () => {
    const bus = useEventBus()

    const wx = reactive({} as { [key: string]: string })
    const subscriptions = reactive({} as { [key: string]: string })
    const lastFetch = reactive({} as { [key: string]: Date })
    const lastQnh = reactive({} as { [key: string]: number })

    const wxPart = (key: string, spanIndex: number) => {
        if (key in wx) {
            const el = document.createElement("div")
            el.innerHTML = wx[key]
            const partEls = el.querySelectorAll(".spanText")
            if (partEls.length > spanIndex)
                return (partEls[spanIndex] as HTMLElement).innerHTML.trim()
        }
        return ""
    }

    const noData = (key: string) => !(key in wx) || wx[key].match("No( recent)? data")
    const time = (key: string) => wxPart(key, 0)
    const rwy = (key: string) => wxPart(key, 1)
    const metreport = (key: string) => wxPart(key, 2)
    const info = (key: string) => wxPart(key, 3)
    const metsensor = (key: string) => wxPart(key, 4)
    const metar = (key: string) => wxPart(key, 5)

    const qnh = (key: string) => {
        const metarText = metar(key)
        if (!metarText) return undefined
        const m = metarText.match(/Q(\d{4})/)
        if (!m || !m[1]) return undefined
        return parseInt(m[1])
    }

    const qnhTrend = (icao: string) => {
        const q = qnh(icao)
        if (q && icao in lastQnh) return q - lastQnh[icao]
        return undefined
    }

    function subscribe(icao: string) {
        const subscriptionId = uuid()
        subscriptions[subscriptionId] = icao
        if (!(icao in wx)) fetch(icao)
        return subscriptionId
    }

    function unsubscribe(subscription: string) {
        if (subscription in subscriptions) {
            const icao = subscriptions[subscription]
            delete subscriptions[subscription]
            if (!Object.values(subscriptions).includes(icao)) {
                delete wx[icao]
                delete lastFetch[icao]
            }
        }
    }

    function fetch(icao: string) {
        if (!icao) {
            console.error("Attempted to fetch weather data with undefined ICAO");
            return;
        }
        if (!(icao in viewIdByIcao)) {
            console.error(`No viewId for icao ${icao}`);
            return;
        }
        if (!(icao in wx)) wx[icao] = "Loading..."
        lastFetch[icao] = new Date()
        console.log(`Fetch wx ${icao}`)
        const previousMetar = metar(icao)
        const previousQnh = qnh(icao)
        axios.get(`https://api.vatiris.se/wx?viewId=${viewIdByIcao[icao]}`).then((response) => {
            wx[icao] = response.data
            lastFetch[icao] = new Date()
            if (previousMetar && metar(icao) != previousMetar) {
                console.log(`  METAR updated QNH ${qnh(icao)}`)
                if (previousQnh) lastQnh[icao] = previousQnh
            }
        })
    }

    if ((window as any).wxRefreshInterval) clearInterval((window as any).wxRefreshInterval)
    ;(window as any).wxRefreshInterval = setInterval(() => {
        for (const icao in lastFetch) {
            if (new Date().getTime() - lastFetch[icao].getTime() > 60000) fetch(icao)
        }
    }, 1000)

    function refresh() {
        for (const icao in wx) delete wx[icao]
        for (const icao in wx) delete lastFetch[icao]
        for (const id in subscriptions) fetch(subscriptions[id])
    }

    bus.on("refresh", () => refresh())

    return {
        wx,
        lastQnh,
        noData,
        time,
        rwy,
        metreport,
        info,
        metsensor,
        metar,
        qnh,
        qnhTrend,
        subscribe,
        unsubscribe,
        fetch,
        refresh,
    }
})
