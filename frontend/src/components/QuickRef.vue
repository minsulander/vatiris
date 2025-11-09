<template>
    <div ref="div" style="width: 100%; height: 100%; overflow-y: hidden">
        <div style="height: 25px; margin-top: -5px; margin-left: -5px; background: #777">
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="!selectedRunway ? 'white' : 'grey-lighten-1'"
                @click="selectedRunway = ''"
                >AUTO</v-btn
            >
            <span v-if="ad == 'ESSA'" class="text-caption">
                <v-btn variant="text" rounded="0" size="small" color="white"
                    >{{ runwayTitle(shownRunway) || "SELECT RUNWAY" }}
                    <v-menu activator="parent" transition="slide-y-transition">
                        <v-list density="compact">
                            <v-list-item
                                v-for="(runway, index) in runways"
                                :key="runway"
                                @click="selectedRunway = runway"
                            >
                                <v-list-item-title
                                    :class="
                                        runway == shownRunway
                                            ? 'text-white'
                                            : runway == activeRunway
                                              ? 'text-orange-lighten-1'
                                              : 'text-grey-lighten-1'
                                    "
                                    >{{ runwayTitle(runway) }}</v-list-item-title
                                >
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </v-btn>
            </span>
            <span v-else>
                <v-btn
                    v-for="runway in runways"
                    :key="runway"
                    variant="text"
                    rounded="0"
                    size="small"
                    :color="
                        runway == shownRunway
                            ? 'white'
                            : runway == activeRunway
                              ? 'orange-lighten-1'
                              : 'grey-lighten-1'
                    "
                    @click="selectedRunway = runway"
                    >{{ runway }}</v-btn
                >
                <v-btn
                    v-if="ad == 'ESGG' && type == 'APP'"
                    variant="text"
                    rounded="0"
                    size="small"
                    color="white"
                    @click="stars = stars == 'OPEN' ? 'CLOSED' : 'OPEN'"
                    >{{ stars }}</v-btn
                >
            </span>
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                color="white"
                style="float: right; margin-bottom: -4px"
            >
                AIP
                <submenu :items="aipItems" />
            </v-btn>
        </div>
        <div v-if="image" style="width: 100%; height: calc(100% - 20px); overflow: auto">
            <Image :id="image" :src="`/quickref/${image}.png`" />
        </div>
        <div v-else-if="shownRunway" class="pa-2">Invalid runway {{ shownRunway }}</div>
        <div v-else-if="!activeRunway" class="pa-2">
            Unable to automatically select runway configuration, please set manually in the menu
            above.
        </div>
        <div v-else class="pa-2">Loading...</div>
    </div>
</template>

<script setup lang="ts">
import Image from "@/components/Image.vue"
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue"
import moment from "moment"
import { useWxStore } from "@/stores/wx"
import { useVatsimStore } from "@/stores/vatsim"
import Submenu from "./menu/Submenu.vue"
import { useEaipStore } from "@/stores/eaip"

const props = defineProps<{ ad: string; type: string; src?: string }>()

const wx = useWxStore()
const vatsim = useVatsimStore()
const eaip = useEaipStore()

const storageKey = `quickref_${props.ad}_${props.type}`

const div = ref()
const selectedRunway = ref(sessionStorage[storageKey + "_selectedRunway"] || "")
const stars = ref(sessionStorage[storageKey + "_stars"] || "CLOSED")

const runways = computed(() => {
    switch (props.ad) {
        case "ESGG":
            return ["03", "21"]
        case "ESSB":
            return ["12", "30"]
        case "ESSA":
            return [
                "01R/01L",
                "19L/19R",
                "01L",
                "01L/08",
                "01R/08",
                "01R",
                "08",
                "08/19L",
                "19L",
                "19L-NIGHT",
                "19L-E",
                "19R/08",
                "19R/19L",
                "19R",
                "26/01L",
                "26/19R",
                "26/19L-Q",
                "26/19L-NIGHT",
                "26/19L-E",
                "26",
            ]
        default:
            return []
    }
})

const runwayTitle = (runway: string) => {
    switch (runway) {
        case "01R/01L":
            return "1 - 01R/01L"
        case "19L/19R":
            return "2 - 19L/19R"
        case "01L":
            return "3 - 01L"
        case "01L/08":
            return "4 - 01L/08-LT"
        case "01R/08":
            return "5 - 01R/08-LT"
        case "01R":
            return "6 - 01R"
        case "08":
            return "7 - 08"
        case "08/19L":
            return "8 - 08/19L-Q"
        case "19L":
            return "9A - 19L-Q"
        case "19L-NIGHT":
            return "9B - 19L-NIGHT"
        case "19L-E":
            return "9C - 19L-E"
        case "19R/08":
            return "10 - 19R/08-RT"
        case "19R/19L":
            return "11 - 19R/19L-E"
        case "19R":
            return "12 - 19R"
        case "26/01L":
            return "13 - 26/01L"
        case "26/19R":
            return "14 - 26/19R"
        case "26/19L-Q":
            return "15A - 26/19L-Q"
        case "26/19L-NIGHT":
            return "15B - 26/19L-NIGHT"
        case "26/19L-E":
            return "15C - 26/19L-E"
        case "26":
            return "16 - 26"
        default:
            return runway
    }
}

const activeRunway = computed(() => {
    if (props.ad == "ESSA") {
        let active = ""
        // Get active runway from ATIS
        const arrAtis =
            vatsim.data.atis && vatsim.data.atis.find((a) => a.callsign == "ESSA_A_ATIS")
        const depAtis =
            vatsim.data.atis && vatsim.data.atis.find((a) => a.callsign == "ESSA_D_ATIS")
        if (arrAtis && depAtis && arrAtis.text_atis && depAtis.text_atis) {
            const arrMatch = arrAtis.text_atis.join(" ").match(/RWY\s+(\d{2}[LRC]?) IN USE/)
            const depMatch = depAtis.text_atis.join(" ").match(/RWY\s+(\d{2}[LRC]?) IN USE/)
            if (arrMatch && depMatch)
                active =
                    arrMatch[1] == depMatch[1] ? `${arrMatch[1]}` : `${arrMatch[1]}/${depMatch[1]}`
        }
        // Get active runway from wx
        if (!active) {
            const rwyText = wx.rwy("ESSA").replace(/<[^>]*>?/gm, "")
            const match = rwyText.match(/ARR: (\d{2}[LRC]?) DEP: (\d{2}[LRC]?)/)
            if (match && match[1] == match[2]) active = match[1]
            else if (match && match[1] && match[2]) active = `${match[1]}/${match[2]}`
        }
        if (
            runways.value.includes(`${active}-NIGHT`) &&
            (moment().hour() >= 22 || moment().hour() < 6)
        )
            active = `${active}-NIGHT`
        if (runways.value.includes(active)) return active
        if (active) console.log("QuickRef ESSA active runway not valid", active)
    } else {
        const atis =
            vatsim.data.atis &&
            vatsim.data.atis.find((a) => a.callsign.startsWith(props.ad.toUpperCase()))
        if (atis && atis.text_atis) {
            const match = atis.text_atis.join(" ").match(/RWY\s+(\d{2}[LRC]?) IN USE/)
            if (match) return match[1]
        }
        const rwyText = wx.rwy(props.ad).replace(/<[^>]*>?/gm, "")
        const match = rwyText.match(/IN USE: (\d{2}[LRC]?)/)
        if (match) return match[1]
    }
    return ""
})

const shownRunway = computed(() => {
    return selectedRunway.value || activeRunway.value
})

const image = computed(() => {
    if (props.ad == "ESGG") {
        if (props.type == "TWR" && shownRunway.value == "03") return "esgg-4"
        if (props.type == "TWR" && shownRunway.value == "21") return "esgg-7"
        if (props.type == "APP" && shownRunway.value == "03")
            return stars.value == "OPEN" ? "esgg-5" : "esgg-6"
        if (props.type == "APP" && shownRunway.value == "21")
            return stars.value == "OPEN" ? "esgg-8" : "esgg-9"
    } else if (props.ad == "ESSB") {
        if (props.type == "TWR" && shownRunway.value == "12") return "essb-5"
        if (props.type == "TWR" && shownRunway.value == "30") return "essb-7"
        if (props.type == "APP" && shownRunway.value == "12") return "essb-6"
        if (props.type == "APP" && shownRunway.value == "30") return "essb-8"
    } else if (props.ad == "ESSA") {
        const config = runways.value.indexOf(shownRunway.value)
        if (config >= 0) {
            const offset = props.type == "TWR" ? 6 : 5
            return `essa-${props.type.toLowerCase()}-` + `${config + offset}`.padStart(2, "0")
        }
    }
    return ""
})

const aipItems = reactive({} as any)

function fillAip() {
    const aip = eaip.aipIndex
    if (aip && aip.airports && aip.airports.find((a: any) => a.icao == props.ad)) {
        for (const document of aip.airports.find((a: any) => a.icao == props.ad).documents) {
            aipItems[document.name] = `aip${document.prefix}`
        }
    }
}
fillAip()
watch(eaip.aipIndex, fillAip, { deep: true })

let wxSubscription: any = undefined
onMounted(() => {
    wxSubscription = wx.subscribe(props.ad)
    if (props.src && div.value) {
        const winbox = div.value.closest(".winbox")
        if (winbox) {
            const title = winbox.querySelector(".wb-title")
            if (title && !title.innerHTML.includes("mdi-open-in-new")) {
                title.innerHTML += ` <a href="${props.src}" target="_blank" style="color: #ddd"><span class="mdi mdi-open-in-new"></span></a> `
            }
        }
    }
})

onUnmounted(() => {
    if (wxSubscription) wx.unsubscribe(wxSubscription)
})

watch([selectedRunway, stars], () => {
    sessionStorage[storageKey + "_selectedRunway"] = selectedRunway.value
    sessionStorage[storageKey + "_stars"] = stars.value
})
</script>
