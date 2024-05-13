import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import { v4 as uuid } from "uuid"
import axios from "axios"

const viewIdByIcao: { [key: string]: string } = {
    ESSA: "arlanda-overview.html",
    ESGG: "landvetter-overview.html"
}

export const useWxStore = defineStore("wx", () => {
    const wx = reactive({} as { [key: string]: string })
    const subscriptions = reactive({} as { [key: string]: string })

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
            if (!Object.values(subscriptions).includes(icao)) delete wx[icao]
        }
    }

    function fetch(icao: string) {
        if (!(icao in viewIdByIcao)) throw `No viewId for icao ${icao}`
        if (!(icao in wx)) wx[icao] = "Loading..."
        axios.get(`https://api.vatiris.se/wx?viewId=${viewIdByIcao[icao]}`).then((response) => {
            console.log(response.data)
            wx[icao] = response.data
        })
    }

    return {
        wx,
        subscribe,
        unsubscribe,
        fetch
    }
})
