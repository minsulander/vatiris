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
        <div class="float-right text-caption text-grey-darken-2">
            {{ time.replace("T", " ") }}
        </div>
        <pre
            class="pa-1"
            :class="
                rwyDiffersToVatsim && !metarAuto
                    ? 'text-orange-darken-4'
                    : hasVatsimAtis && !changed
                      ? 'text-grey-darken-1'
                      : ''
            "
            style="font-size: 14px; line-height: 16px; white-space: pre-wrap"
            v-html="rwy"
        ></pre>
        <pre
            class="pa-1"
            style="font-size: 14px; line-height: 16px; white-space: pre-wrap"
            v-html="formattedMetreport"
        ></pre>
        <pre
            class="pa-1"
            style="font-size: 14px; line-height: 16px; white-space: pre-wrap"
            v-html="info"
        ></pre>
        <pre
            class="pa-1"
            style="font-size: 14px; line-height: 16px; white-space: pre-wrap"
            v-html="metar"
        ></pre>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue"
import { useWxStore } from "@/stores/wx"
import { useVatsimStore } from "@/stores/vatsim"
import useEventBus from "@/eventbus"
import { useSettingsStore } from "@/stores/settings"

const props = defineProps<{ id: string }>()

const wx = useWxStore()
const settings = useSettingsStore()
const vatsim = useVatsimStore()
const bus = useEventBus()

const time = computed(() => wx.time(props.id))
const rwy = computed(() => wx.rwy(props.id))
const metreport = computed(() => wx.metreport(props.id))
const info = computed(() => wx.info(props.id))
const metar = computed(() => wx.metar(props.id))

const metarAuto = computed(() => metar.value && metar.value.includes(" AUTO "))

const firstUpdate = ref(true)

const hasVatsimAtis = computed(() => {
    const atis =
        vatsim.data.atis &&
        vatsim.data.atis.find((atis) => atis.callsign.startsWith(props.id + "_"))
    return !!atis
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
            !rwyText.includes(`ARR: ${arrRwyInUse}`) &&
            !rwyText.includes(`DEP: ${depRwyInUse}`)
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

const ATISAirportCodes = ["ESGG", "ESKN", "ESMS", "ESNN", "ESOW", "ESSA", "ESSB", "ESTL"]

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

const isATISAirport = computed(() => ATISAirportCodes.includes(airportCode.value))

const formatMetreport = (report: string) => {
    if (!report) return ""

    // QNH styling
    let formattedReport = report.replace(/(QNH\s+)(\d+\s\d+\s\d+\s\d+)/g, (match, p1, p2) => {
        return `${p1}<div style="display: inline-block; font-size: 20px; font-weight: bold; margin-top: 7px">${p2}</div>`
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

let subscription = ""

function click() {
    for (const timeout of changeTimeouts) clearTimeout(timeout)
    changeTimeouts.splice(0)
    changed.value = changedLong.value = false
}

onMounted(() => {
    subscription = wx.subscribe(props.id)
})

onUnmounted(() => {
    wx.unsubscribe(subscription)
})

bus.on("refresh", () => {
    firstUpdate.value = true
    changed.value = false
    changedLong.value = false
})

watch([rwy, metreport, info, metar], (newValues, oldValues) => {
    if (firstUpdate.value) {
        firstUpdate.value = false
        return
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
