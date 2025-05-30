<template>
    <div v-if="wx.noData(props.id)" class="pa-3 text-center">NO DATA</div>
    <div v-if="wx.wx[props.id] && wx.wx[props.id].endsWith('...')" class="pa-3 text-center">
        {{ wx.wx[props.id] }}
    </div>
    <div
        class="metreport"
        v-else
        :style="changed ? 'background-color: #33f; color: #ddd' : changedLong ? 'color: #33f' : ''"
        style="height: 100%"
        @click="click"
    >
        <div v-if="outdated" class="float-right text-caption font-weight-bold text-orange-darken-4">
            {{ time.replace("T", " ") }}
        </div>
        <div v-else class="float-right" style="height: 15px; width: 50px">
            <!--spacer for M W A buttons-->
        </div>
        <pre
            class="pa-1"
            style="font-size: 14px; line-height: 16px; white-space: pre-wrap"
            v-html="formattedMetreport"
        ></pre>
        <pre
            class="pa-1"
            style="font-size: 14px; line-height: 16px; white-space: pre-wrap"
            v-html="infoWithoutTaf"
        ></pre>
        <pre
            class="pa-1"
            style="font-size: 14px; line-height: 16px; white-space: pre-wrap"
            v-html="metar"
            v-if="!formattedMetreport"
        ></pre>
    </div>
</template>

<script setup lang="ts">
import useEventBus from "@/eventbus"
import { useMetarStore } from "@/stores/metar"
import { useSettingsStore } from "@/stores/settings"
import { useVatsimStore } from "@/stores/vatsim"
import { useWxStore } from "@/stores/wx"
import { atisAirports } from "@/metcommon"
import moment from "moment"
import { computed, onMounted, onUnmounted, ref, watch } from "vue"

const props = defineProps<{ id: string; type?: "ARR" | "DEP" }>()

const wx = useWxStore()
const metarStore = useMetarStore()
const settings = useSettingsStore()
const vatsim = useVatsimStore()
const bus = useEventBus()

const time = computed(() => wx.time(props.id))
const rwy = computed(() => wx.rwy(props.id))
const metreport = computed(() => {
    let metreport = wx.metreport(props.id)
    if (!metreport && wx.metar(props.id)) {
        metreport = metarStore.metreportFromMetar(wx.metar(props.id))
        let runway = rwy.value.replaceAll("RUNWAY IN USE: <b>", "").replaceAll("</b>", "")
        let otherRunway = ""
        if (props.type) {
            metreport = metreport.replace("ESSA        ", `ESSA     ${props.type}`)
            const m = runway.match(/ARR: (.*) DEP: (.*)/)
            if (m && props.type == "ARR") {
                runway = m[1]
                otherRunway = m[2]
            } else if (m && props.type == "DEP") {
                runway = m[2]
                otherRunway = m[1]
            }
        } else {
            runway = runway.replaceAll("ARR: ", "").replaceAll(" DEP: ", "/")
        }
        runway = runway.padEnd(11)
        if (hasVatsimAtis.value && rwyDiffersToVatsim.value && !metarAuto.value) {
            runway = `<span class="text-orange-darken-3 font-weight-bold">${runway}</span>`
            if (otherRunway)
                otherRunway = `<span class="text-orange-darken-3 font-weight-bold">${otherRunway}</span>`
        } else if (hasVatsimAtis.value) {
            runway = `<span class="text-grey-darken-1">${runway}</span>`
            if (otherRunway) otherRunway = `<span class="text-grey-darken-1">${otherRunway}</span>`
        }
        metreport = metreport.replace(/RWY --\s+/, `RWY ${runway}`)
        if (otherRunway) {
            let lines = metreport.split("\n")
            lines[1] += (props.type == "ARR" ? " DEP" : " ARR") + " RWY " + otherRunway
            metreport = lines.join("\n")
        }
        if (typeof qnhTrend.value != "undefined") {
            const trend =
                qnhTrend.value > 0
                    ? " <div style='display: inline-block; transform: rotate(-90deg);'><i class='mdi mdi-play'></i></div>"
                    : qnhTrend.value < 0
                      ? " <div style='display: inline-block; transform: rotate(90deg);'><i class='mdi mdi-play'></i></div>"
                      : " <i class='mdi mdi-play'></i>"
            metreport = metreport.replace('id="qnh-trend">', `'id="qnh-trend">${trend}`)
        }
    } else {
        metreport = metreport.replace("                        ", "              ")
        if (hasVatsimAtis.value && rwyDiffersToVatsim.value) {
            metreport = metreport.replace(
                /\nRWY\s+(\d+[LRC]?)/,
                "\nRWY <span class='text-orange-darken-3 font-weight-bold'>$1</span>",
            )
        } else if (hasVatsimAtis.value) {
            metreport = metreport.replace(
                /\nRWY\s+(\d+[LRC]?)/,
                "\nRWY <span class='text-grey-darken-1'>$1</span>",
            )
        }
    }
    return metreport
})
const info = computed(() => {
    let text = wx.info(props.id)
    if (props.id == "ESSA") {
        text = text.replaceAll("\n \n", "\n").replace("SIGMET: \n", "")
        if (props.type) {
            // Filter surface condition codes for arr/dep runway
            let runway = rwy.value.replaceAll("RUNWAY IN USE: <b>", "").replaceAll("</b>", "")
            const m = runway.match(/ARR: (.*) DEP: (.*)/)
            if (m && props.type == "ARR") {
                runway = m[1]
            } else if (m && props.type == "DEP") {
                runway = m[2]
            }
            let lines = []
            for (const line of text.split("\n")) {
                const m = line.match(/^(\d\d[LR]?): /)
                if (m) {
                    if (
                        m[1] == runway ||
                        (m[1] == "08" && runway == "26") ||
                        (m[1] == "01L" && runway == "19R") ||
                        (m[1] == "01R" && runway == "19L")
                    ) {
                        lines.push(line.substring(m[1].length + 2))
                    }
                    continue
                }
                lines.push(line)
            }
            text = lines.join("\n")
        }
    }
    text = text.replace("ATS LANDVETTER", "")
    if (metarAuto.value) text += "\nAUTO"
    return text.trim()
})
const metar = computed(() => wx.metar(props.id))
const qnh = computed(() => wx.qnh(props.id))
const lastQnh = ref(undefined as number | undefined)

const metarAuto = computed(() => metar.value && metar.value.includes(" AUTO "))

const qnhTrend = computed(() => wx.qnhTrend(props.id))

const infoWithoutTaf = computed(() => {
    if (!info.value) return ""
    let text = info.value
    let tafIndex = text.indexOf(`TAF ${props.id}`)
    if (tafIndex < 0) tafIndex = text.indexOf(`TAF AMD ${props.id}`)
    if (tafIndex >= 0) return text.substring(0, tafIndex)
    return text
})

const firstUpdate = ref(true)
const outdated = ref(false)

const hasVatsimAtis = computed(() => {
    if (props.id == "ESSA") {
        const arrAtis =
            vatsim.data.atis && vatsim.data.atis.find((atis) => atis.callsign.startsWith("ESSA_A"))
        const depAtis =
            vatsim.data.atis && vatsim.data.atis.find((atis) => atis.callsign.startsWith("ESSA_D"))
        return arrAtis && depAtis && arrAtis.text_atis && depAtis.text_atis
    } else {
        const atis =
            vatsim.data.atis &&
            vatsim.data.atis.find((atis) => atis.callsign.startsWith(props.id + "_"))
        return atis && atis.text_atis
    }
})

const rwyDiffersToVatsim = computed(() => {
    if (props.id == "ESSA") {
        const arrAtis =
            vatsim.data.atis && vatsim.data.atis.find((atis) => atis.callsign.startsWith("ESSA_A"))
        const depAtis =
            vatsim.data.atis && vatsim.data.atis.find((atis) => atis.callsign.startsWith("ESSA_D"))
        if (!arrAtis || !arrAtis.text_atis || arrAtis.text_atis.length == 0) return false
        if (!depAtis || !depAtis.text_atis || depAtis.text_atis.length == 0) return false
        const arrRwyInUse = arrAtis.text_atis.join(" ")?.match(/RWY\s+(\d+[LRC]?) IN USE/)?.[1]
        const depRwyInUse = depAtis.text_atis.join(" ")?.match(/RWY\s+(\d+[LRC]?) IN USE/)?.[1]
        const rwyText = rwy.value.replace(/<[^>]*>?/gm, "")
        return (
            arrRwyInUse &&
            depRwyInUse &&
            (!rwyText.includes(`ARR: ${arrRwyInUse}`) || !rwyText.includes(`DEP: ${depRwyInUse}`))
        )
    } else {
        const atis =
            vatsim.data.atis &&
            vatsim.data.atis.find((atis) => atis.callsign.startsWith(props.id + "_"))
        if (!atis || !atis.text_atis || atis.text_atis.length == 0) return false
        const rwyInUse = atis.text_atis.join(" ")?.match(/RWY\s+(\d+[LRC]?) IN USE/)?.[1]
        const rwyText = rwy.value.replace(/<[^>]*>?/gm, "")
        return rwyInUse && !rwyText.endsWith(rwyInUse)
    }
})

// List of keywords to be styled. X-R not working
const keywords = [
    "ALF",
    "BRA",
    "CHA",
    "DEL",
    "ECH",
    "FOX",
    "GOL",
    "HOT",
    "IND",
    "JUL",
    "KIL",
    "LIM",
    "MIK",
    "NOV",
    "OSC",
    "PAP",
    "QUE",
    "ROM",
    "SIE",
    "TAN",
    "UNI",
    "VIC",
    "WHI",
    "X-R",
    "YAN",
    "ZUL",
]

// Extract ICAO code from the fetched data
const getAirportCode = (data: string) => {
    const match = data.match(/^[A-Z]{4}/)
    return match ? match[0] : ""
}

// Determine if the airport code is valid
const airportCode = computed(() => {
    const data = wx.metreport(props.id) || ""
    return getAirportCode(data)
})

const isATISAirport = computed(() => atisAirports.includes(airportCode.value))

const formatMetreport = (report: string) => {
    if (!report) return ""

    // Removes \n in text after TRL
    //Finds where the "free text" starts
    for (let i = report.length; i > 2; i--) {
        var value = report[i - 2] + report[i - 1] + report[i]
        if (value == "TRL") {
            var start = i + 5

            // Splits string into pre "free text" and "free text"
            var s1 = report.slice(0, start)
            var s2 = report.slice(start)

            // Removes all backspaces
            s2 = s2.replaceAll("\n", " ")

            // Merge back the report
            report = s1 + s2
            break
        }
    }

    // QNH styling
    let formattedReport = report.replace(/(QNH\s+)(\d+\s\d+\s\d+\s\d+)/g, (match, p1, p2) => {
        const trend =
            typeof qnhTrend.value == "undefined"
                ? ""
                : qnhTrend.value > 0
                  ? " <div style='display: inline-block; transform: rotate(-90deg);'><i class='mdi mdi-play'></i></div>"
                  : qnhTrend.value < 0
                    ? " <div style='display: inline-block; transform: rotate(90deg);'><i class='mdi mdi-play'></i></div>"
                    : " <i class='mdi mdi-play'></i>"
        return `${p1}<div style="display: inline-block; font-size: 20px; font-weight: bold; margin-top: 7px; margin-bottom: 7px">${p2}${trend}</div>`
    })

    // Issuing time styling
    formattedReport = formattedReport.replace(/\b(\d{6}Z)\b/g, (match) => {
        return `<span style="font-weight: bold;">${match}</span>`
    })

    // Style ID letter ff ATIS airport
    if (isATISAirport.value) {
        formattedReport = formattedReport.replace(/\b([\w-]{3,4})\b/g, (match) => {
            if (keywords.includes(match)) {
                return hasVatsimAtis.value && !changed.value
                    ? `<span style="font-size: 16px;" class="text-grey-darken-1">${match}</span>`
                    : `<span style="font-size: 16px; font-weight: bold;">${match}</span>`
            }
            return match
        })
    } else {
        // Remove the ID letter if NOT an ATIS airport
        formattedReport = formattedReport.replace(/\b([\w-]{3,4})\b/g, (match) => {
            if (keywords.includes(match)) {
                return "   " // Hide keyword
            }
            return match
        })
    }

    return formattedReport
}

const formattedMetreport = computed(() => formatMetreport(metreport.value || ""))

const changed = ref(false)
const changedLong = ref(false)
let changeTimeouts: any[] = []

let wxSubscription = ""
let metarSubscription = ""

function click() {
    for (const timeout of changeTimeouts) clearTimeout(timeout)
    changeTimeouts.splice(0)
    changed.value = changedLong.value = false
}

let mountedTime = Date.now()
let checkOutdatedInterval: any = undefined
onMounted(() => {
    mountedTime = Date.now()
    wxSubscription = wx.subscribe(props.id)
    metarSubscription = metarStore.subscribe(props.id)
    checkOutdatedInterval = setInterval(() => {
        outdated.value =
            time.value.length > 0 && moment(time.value).isBefore(moment().subtract(5, "minutes"))
    }, 5000)
})

onUnmounted(() => {
    clearInterval(checkOutdatedInterval)
    wx.unsubscribe(wxSubscription)
    metarStore.unsubscribe(metarSubscription)
})

bus.on("refresh", () => {
    firstUpdate.value = true
    changed.value = false
    changedLong.value = false
})

watch([rwy, metreport, info, metar], (newValues, oldValues) => {
    if (firstUpdate.value || Date.now() - mountedTime < 5000) {
        firstUpdate.value = false
        return
    }
    if (oldValues[3] && newValues[3] != oldValues[3]) {
        const m = oldValues[3].match(/Q(\d{4})/)
        if (m && m[1]) lastQnh.value = parseInt(m[1])
    }
    changed.value = false
    if (!settings.metreportFlash) return
    for (var i = 0; i < newValues.length; i++) {
        if (oldValues[i] && oldValues[i].length > 0 && newValues[i] != oldValues[i]) {
            changed.value = true
            break
        }
    }
    if (changed.value) {
        changeTimeouts.splice(0)
        changeTimeouts.push(setTimeout(() => (changed.value = false), 1000))
        changeTimeouts.push(setTimeout(() => (changed.value = true), 2000))
        changeTimeouts.push(
            setTimeout(() => {
                changed.value = false
                changedLong.value = true
            }, 3000),
        )
        changeTimeouts.push(
            setTimeout(() => {
                changed.value = false
                changedLong.value = false
            }, 63000),
        )
    }
})
</script>
