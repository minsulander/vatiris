<template>
    <div v-if="wx.noData(props.id)" class="pa-3 text-center">NO DATA</div>
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

const props = defineProps<{ id: string }>()

const wx = useWxStore()

const time = computed(() => wx.time(props.id))
const rwy = computed(() => wx.rwy(props.id))
const metreport = computed(() => wx.metreport(props.id))
const info = computed(() => wx.info(props.id))
const metar = computed(() => wx.metar(props.id))

// List of valid airport codes
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

const isValidAirport = computed(() => ATISAirportCodes.includes(airportCode.value))

const formatMetreport = (report: string) => {
    if (!report) return ""

    // QNH styling (3-4 letters, maybe always 4?)
    let formattedReport = report.replace(/(QNH\s+)((?:\d+\s){3,4}\d+)/g, (match, p1, p2) => {
        return `${p1}<div style="display: inline-block; font-size: 21px; font-weight: bold; margin-top: 7px">${p2}</div>`
    })

    // Issuing time styling
    formattedReport = formattedReport.replace(/\b(\d{6}Z)\b/g, (match) => {
        return `<span style="font-weight: bold;">${match}</span>`
    })

    // Style ID letter ff ATIS airport
    if (isValidAirport.value) {
        formattedReport = formattedReport.replace(/\b([\w-]{3,4})\b/g, (match) => {
            if (keywords.includes(match)) {
                return `<span style="font-size: 16px; font-weight: bold;">${match}</span>`
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

watch([rwy, metreport, info, metar], (newValues, oldValues) => {
    if (oldValues.find((v) => v.length > 0)) {
        changed.value = true
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
