import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import { v4 as uuid } from "uuid"
import axios from "axios"
import useEventBus from "@/eventbus"
import { parseMetar } from "metar-taf-parser"
import { calculateTrl } from "@/metcommon"
import moment from "moment"

export const useMetarStore = defineStore("metar", () => {
    const bus = useEventBus()

    const time = ref("")
    const metar = reactive({} as { [key: string]: string })
    const history = reactive({} as { [key: string]: string[] })
    const subscriptions = reactive({} as { [key: string]: string })
    const lastFetch = ref(0)

    const parse = (icao: string) =>
        icao in metar && !metar[icao].includes("Loading") ? parseMetar(metar[icao]) : undefined

    const qnhTrend = (icao: string) => {
        if (!(icao in metar)) return undefined
        const cm = metar[icao].match(/Q(\d{4})/)
        if (!cm || !cm[1] || !isFinite(parseInt(cm[1]))) return undefined
        const current = parseInt(cm[1])
        const m = history[icao][0].match(/Q(\d{4})/)
        if (!m || !m[1] || !isFinite(parseInt(m[1]))) return undefined
        const qnh = parseInt(m[1])
        return current - qnh
    }

    const formattedMetreport = (icao: string) => {
        if (!metar[icao] || metar[icao].includes("Loading")) return metar[icao]
        return metreportFromMetar(metar[icao])
    }

    const metreportFromMetar = (metar: string) => {
        try {
            const parsed = parseMetar(metar)
            if (!parsed) return "PARSE FAIL" + (metar ? `: ${metar}` : "")
            if (!parsed.type) return metar || "NOT A METAR"
            const header = `${parsed.station}                       ${time.value ? moment(time.value).format("YYMMDD") : "------"}${parsed.auto ? "    AUTO" : ""}${parsed.corrected ? "    COR" : ""}`
            const rwy = "--"
            const header2 = `RWY ${rwy.padEnd(11)}MET REPORT  <b>${String(parsed.day).padStart(2, "0")}${String(parsed.hour).padStart(2, "0")}${String(parsed.minute).padStart(2, "0")}Z</b>`
            let wind = `WIND `
            if (parsed.wind) {
                if (!parsed.wind.speed && !parsed.wind.gust && !parsed.wind.degrees) {
                    wind += "CALM"
                } else {
                    wind += parsed.wind.degrees
                        ? String(parsed.wind.degrees).padStart(3, "0")
                        : parsed.wind.direction
                    wind += `/${parsed.wind.speed}${parsed.wind.unit || "KT"}`
                    if (parsed.wind.gust) wind += ` G${parsed.wind.gust}${parsed.wind.unit || "KT"}`
                    if (parsed.wind.minVariation && parsed.wind.maxVariation) {
                        wind += ` VRB BTN ${String(parsed.wind.minVariation).padStart(3, "0")}/ AND ${String(parsed.wind.maxVariation).padStart(3, "0")}/`
                    }
                }
            } else {
                wind += "???"
            }
            let visibility = `VIS `
            if (parsed.cavok) {
                visibility = "CAVOK"
            } else if (parsed.visibility) {
                if (
                    (parsed.visibility.value >= 5000 &&
                        parsed.visibility.value != 9999 &&
                        parsed.visibility.unit == "m") ||
                    (parsed.visibility.value == 9999 && parsed.visibility.unit == "m")
                ) {
                    visibility += `${Math.ceil(parsed.visibility.value / 1000)}KM`
                } else {
                    visibility += `${parsed.visibility.value}`
                    if (parsed.visibility.unit != "m") {
                        visibility += ` ${parsed.visibility.unit}`
                    } else if (parsed.visibility.value <= 4999) {
                        visibility += "M"
                    }
                }
            } else {
                visibility += "???"
            }
            let conditions = ""
            if (parsed.weatherConditions && parsed.weatherConditions.length > 0) {
                // TODO verify different conditions with intensities etc
                for (const condition of parsed.weatherConditions) {
                    conditions += `${condition.intensity || ""}${condition.phenomenons.join(" ")}`
                }
            }
            let clouds = "CLD"
            if (parsed.clouds && parsed.clouds.length > 0) {
                for (const cloud of parsed.clouds) {
                    if (cloud.quantity) clouds += ` ${cloud.quantity}`
                    if (cloud.height) clouds += ` ${cloud.height}FT`
                    if (cloud.type) clouds += ` ${cloud.type}`
                    if (cloud.secondaryType) clouds += ` ${cloud.secondaryType}`
                }
            } else if (parsed.verticalVisibility) {
                let vvValue = `${parsed.verticalVisibility / 100}`
                while (vvValue.length < 3) vvValue = "0" + vvValue
                clouds = `CLD VER VIS ${parsed.verticalVisibility}FT`
            } else if (parsed.cavok) {
                clouds = ""
            } else {
                clouds = "NCLD"
            }
            let tempValue =
                (typeof parsed.temperature == "number" && "" + Math.abs(parsed.temperature)) || "??"
            if (tempValue.length == 1) tempValue = "0" + tempValue
            if (parsed.temperature && parsed.temperature < 0) tempValue = "MS" + tempValue
            let dewpointValue =
                (typeof parsed.dewPoint == "number" && "" + Math.abs(parsed.dewPoint)) || "??"
            if (dewpointValue.length == 1) dewpointValue = "0" + dewpointValue
            if (parsed.dewPoint && parsed.dewPoint < 0) dewpointValue = "MS" + dewpointValue
            const temp = `T${tempValue}      DP${dewpointValue}`

            let qnh = "QNH"
            if (parsed.altimeter) {
                let qnhValue = `${parsed.altimeter.value}`
                if (qnhValue.length == 3) qnhValue = "0" + qnhValue
                qnhValue = qnhValue.split("").join(" ")
                qnh += ` <div style="display: inline-block; font-size: 20px; font-weight: bold; margin-top: 7px">${qnhValue}<span id="qnh-trend"></span></div> ${parsed.altimeter.unit.toUpperCase()}`
                const trl = calculateTrl(parsed.station, parsed.altimeter.value)
                if (trl) qnh += `   TRL ${trl}`
            } else {
                qnh += " ???"
            }
            const info = ""

            // Tweak AUTO NCD/10KM to read CAVOK
            if (
                parsed.auto &&
                (clouds == "NCD" || clouds == "CLD NCD" || clouds == "NCLD") &&
                (visibility == "VIS 10KM" || visibility == "VIS 9999")
            ) {
                visibility = "CAVOK"
                clouds = ""
            }

            // TODO NOSIG = parsed.nosig, parsed.trends, parsed.remarks
            // TODO RVR = parsed.runwaysInfo

            const text = `${header}\n${header2}\n${wind}\n\n${visibility}\n\n${conditions}\n\n${clouds}\n${temp}\n${qnh}\n${info}`
            return text
        } catch (e) {
            console.error("Error parsing metar", metar, e)
            return "PARSE FAIL"
        }
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
        axios.get(`https://api.vatiris.se/metar?ids=${icaos}&hours=3`).then((response) => {
            const gotfirst: { [key: string]: boolean } = {}
            for (const section of (response.data as string).split(/\n+/)) {
                const text = section.trim()
                const m = text.match(/^METAR (\w{4})/)
                if (m && m[1]) {
                    const icao = m[1]
                    if (!(icao in gotfirst)) {
                        metar[icao] = text
                        history[icao] = []
                        gotfirst[icao] = true
                    } else {
                        history[icao].push(text)
                    }
                }
            }
            for (const icao of airports) {
                if (metar[icao] && metar[icao].includes("Loading")) metar[icao] = ""
            }
            lastFetch.value = Date.now()
            time.value = moment().utc().toISOString()
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
        time,
        metar,
        history,
        parse,
        qnhTrend,
        formattedMetreport,
        metreportFromMetar,
        subscribe,
        unsubscribe,
        fetch,
        refresh,
    }
})
