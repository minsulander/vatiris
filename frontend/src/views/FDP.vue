<template>
    <v-app-bar color="#2b2d31" height="30" elevation="0">
        <v-btn variant="text" color="grey" to="/"
            ><v-icon>mdi-chevron-left</v-icon> RETURN TO APP</v-btn
        >
    </v-app-bar>
    <v-main>
        <div style="position: relative">
            <div style="position: absolute; left: 50px; top: 5px; color: #888; font-size: 12px; z-index: 101">
                <div v-if="fdp.loading">Loading...</div>
                <div v-else-if="fdp.general">{{ moment(fdp.general.update_timestamp).utc().format('YYYY-MM-DD HH:mm:ss') }} {{ parseInt(fdp.stats.processing_time) }}s</div>
                <div v-if="fdp.flights">{{ Object.keys(fdp.flights).length }} flights {{ Object.keys(fdp.sectors).length }} sectors</div>
                <select v-model="sectorSelection">
                    <option v-for="option in sectorOptions" :key="option.title" :value="option.value">
                        {{ option.title }}
                    </option>
                </select>
                <OccupancyChart style="width: 400px; height: 150px" :sectors="sectorSelection.split('+')"/>
            </div>
        </div>
        <FdpInspectorMap style="width: 100%; height: calc(100vh - 30px)" />
    </v-main>
</template>

<script setup lang="ts">
import FdpInspectorMap from "@/components/fdp/FdpInspectorMap.vue"
import OccupancyChart from "@/components/fdp/OccupancyChart.vue";
import { useFdpStore } from "@/stores/fdp"
import { computed, onMounted, onUnmounted, reactive, ref } from "vue"
import moment from "moment"

const fdpStore = useFdpStore()
const fdp = computed(() => fdpStore.fdp)

const sectorSelection = ref("APPW+APPE+APPS+F01L+F01R+F08+F19R+F19L+F26")
const sectorOptions = reactive([
    { title: "APPW", value: "APPW" },
    { title: "APPE", value: "APPE" },
    { title: "TMA", value: "APPW+APPE+APPS+F01L+F01R+F08+F19R+F19L+F26" },
    { title: "TWR", value: "SA_TWRE+SA_TWRW" },
    { title: "S2", value: "ESOS2" },
    { title: "S7", value: "ESOS7" },
    { title: "MMK", value: "ESMMK" },
    { title: "MML", value: "ESMML" },
    { title: "MMKL", value: "ESMMK+ESMML" },
    { title: "EKCH", value: "EKCH_TWR" },
    { title: "GG_TWR", value: "GG_TWR+GG_GND" },
    { title: "GG_APP", value: "GGAPPE+GGAPPN+GGAPPE21" },
    {
        title: "ESOS-ALL",
        value: "ESOS1+ESOS2+ESOS3+ESOS4+ESOS5+ESOS6+ESOS7+ESOS8+ESOSN+ESOSF+ESOSK",
    },
])


let subscription: any = undefined
onMounted(() => {
    subscription = fdpStore.subscribe()
})
onUnmounted(() => {
    if (subscription) fdpStore.unsubscribe(subscription)
    subscription = undefined
})
</script>
