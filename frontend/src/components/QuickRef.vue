<template>
    <div style="width: 100%; height: 100%; background: #666; overflow-y: hidden">
        <div style="height: 25px; margin-top: -5px; background: #777">
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
                    >{{ shownRunway }}
                    <v-menu activator="parent" transition="slide-y-transition">
                        <v-list density="compact">
                            <v-list-item
                                v-for="runway in runways"
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
                                    >{{ runway }}</v-list-item-title
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
                    v-if="ad == 'ESGG'"
                    variant="text"
                    rounded="0"
                    size="small"
                    color="white"
                    @click="stars = stars == 'OPEN' ? 'CLOSED' : 'OPEN'"
                    >{{ stars }}</v-btn
                >
            </span>
        </div>
        <div v-if="image" style="width: 100%; height: calc(100% - 20px); overflow: auto">
            <Image :id="image" :src="`/quickref/${image}.png`" />
        </div>
    </div>
</template>

<script setup lang="ts">
import Image from "@/components/Image.vue"
import { computed, onMounted, onUnmounted, ref } from "vue"
import moment from "moment"
import { useWxStore } from "@/stores/wx"
import { useVatsimStore } from "@/stores/vatsim"

const props = defineProps<{ ad: string; type: string }>()

const wx = useWxStore()
const vatsim = useVatsimStore()

const selectedRunway = ref("")
const stars = ref("CLOSED")

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
                "19R/08",
                "19R/19L",
                "19R",
                "26/01L",
                "26/19R",
                "26/19L",
                "26/19L-NIGHT",
                "26",
            ]
        default:
            return []
    }
})

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
        if (config >= 0)
            return `essa-${props.type.toLowerCase()}-` + `${config + 7}`.padStart(2, "0")
        return "essa-twr-03"
    }
    return ""
})

// TODO store settings in localStorage and preset

let wxSubscription: any = undefined
onMounted(() => {
    wxSubscription = wx.subscribe(props.ad)
})

onUnmounted(() => {
    if (wxSubscription) wx.unsubscribe(wxSubscription)
})
</script>
