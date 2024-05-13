import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import { v4 as uuid } from "uuid"
import axios from "axios"

const viewIdByIcao: { [key: string]: string } = {
    ESSA: "arlanda-overview.html",
    ESSB: "bromma-overview.html",
    ESNL: "lycksele-overview.html",
    ESKM: "mora-overview.html",
    ESUP: "pajala-overview.html",
    ESMX: "vaxjo-overview.html",
    ESND: "sveg-overview.html",
    ESGP: "save-overview.html",
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
    const wx = reactive({} as { [key: string]: string })
    const subscriptions = reactive({} as { [key: string]: string })
    const lastFetch = reactive({} as { [key: string]: Date })

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
        if (!(icao in viewIdByIcao)) throw `No viewId for icao ${icao}`
        if (!(icao in wx)) wx[icao] = "Loading..."
        lastFetch[icao] = new Date()
        console.log(`Fetch wx ${icao}`)
        axios.get(`https://api.vatiris.se/wx?viewId=${viewIdByIcao[icao]}`).then((response) => {
            wx[icao] = response.data
            lastFetch[icao] = new Date()
        })
    }

    if ((window as any).wxRefreshInterval) clearInterval((window as any).wxRefreshInterval)
    ;(window as any).wxRefreshInterval = setInterval(() => {
        for (const icao in lastFetch) {
            if (new Date().getTime() - lastFetch[icao].getTime() > 60000) fetch(icao)
        }
    }, 1000)

    return {
        wx,
        subscribe,
        unsubscribe,
        fetch
    }
})
