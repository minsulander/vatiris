<template>
    <div class="text-caption" style="position: absolute; right: 0">
        <a
            title="Source: METAR"
            class="pa-1 font-weight-bold"
            @click="source = 'metar'"
            :style="{ color: source == 'metar' ? '#444' : '#999' }"
            >M</a
        >
        <a
            v-if="awosAvailable"
            title="Source: WX.AWOS.SE"
            class="pa-1 font-weight-bold"
            @click="source = 'awos'"
            :style="{ color: source == 'awos' ? '#444' : '#999' }"
            >W</a
        >
        <a
            v-if="atisAvailable"
            title="Source: ATIS"
            class="pa-1 font-weight-bold"
            @click="source = 'atis'"
            :style="{ color: source == 'atis' ? '#444' : '#999' }"
            >A</a
        >
    </div>
    <MetreportMETAR v-if="source == 'metar'" :id="id" />
    <MetreportWX v-else-if="awosAvailable && source == 'awos'" :id="id" :type="type" />
    <MetreportATIS v-else-if="atisAvailable && source == 'atis'" :id="id" :type="type" />
    <div class="pa-1" v-else>Source is what now??</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import MetreportMETAR from "./MetreportMETAR.vue"
import MetreportWX from "./MetreportWX.vue"
import MetreportATIS from "./MetreportATIS.vue"
import { useWxStore } from "@/stores/wx"
import { useMetarStore } from "@/stores/metar"
import { useVatsimStore } from "@/stores/vatsim"
import { wxAirports, atisAirports } from "@/metcommon" 

const props = defineProps<{ id: string; type?: "ARR" | "DEP" }>()

const wx = useWxStore()
const metar = useMetarStore()
const vatsim = useVatsimStore()

const source = ref("metar")

const awosAvailable = computed(() =>
    wxAirports.includes(props.id) &&
    (wx.metreport(props.id) || wx.info(props.id) || wx.metar(props.id))
        ? true
        : false,
)
const atisAvailable = computed(() =>
    atisAirports.includes(props.id) &&
    vatsim.data &&
    vatsim.data.atis &&
    vatsim.data.atis.find(
        (a) =>
            a.callsign.startsWith(
                props.id +
                    (props.type == "ARR" ? "_A" : props.type == "DEP" ? "_D" : ""),
            ) &&
            a.text_atis &&
            a.text_atis.length > 0,
    )
        ? true
        : false,
)

let wxSubscription = ""
let metarSubscription = ""

onMounted(() => {
    wxSubscription = wx.subscribe(props.id)
    metarSubscription = metar.subscribe(props.id)
    source.value = atisAvailable.value ? "atis" : awosAvailable.value ? "awos" : "metar"
})

onUnmounted(() => {
    if (wxSubscription) wx.unsubscribe(wxSubscription)
    if (metarSubscription) metar.unsubscribe(metarSubscription)
})

watch([awosAvailable, atisAvailable], (newValues, oldValues) => {
    let changed = false
    for (let i = 0; i < newValues.length; i++) {
        if (newValues[i] != oldValues[i]) changed = true
    }
    if (changed) {
        if (atisAvailable.value) source.value = "atis"
        else if (awosAvailable.value) source.value = "awos"
        else source.value = "metar"
    }
})
</script>
