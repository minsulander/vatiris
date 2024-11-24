<template>
    <v-app-bar color="#2b2d31" height="30" elevation="0">
        <v-btn variant="text" color="grey" to="/"
            ><v-icon>mdi-chevron-left</v-icon> RETURN TO APP</v-btn
        >
    </v-app-bar>
    <v-main>
        <div style="position: relative">
            <div
                style="
                    position: absolute;
                    left: 50px;
                    top: 5px;
                    color: #888;
                    font-size: 12px;
                    z-index: 101;
                "
            >
                <div v-if="fdp.loading">Loading...</div>
                <div v-else-if="fdp.general">
                    {{ parseInt(fdp.stats.processing_time) }}s
                </div>
                <div v-if="fdp.flights">
                    {{ Object.keys(fdp.flights).length }} flights
                    {{ Object.keys(fdp.sectors).length }} sectors
                </div>
                <select v-model="sectorFilter">
                    <option
                        v-for="option in sectorOptions"
                        :key="option.title"
                        :value="option.value"
                    >
                        {{ option.title }}
                    </option>
                </select>
                <OccupancyChart
                    style="width: 400px; height: 150px"
                    :sectors="sectors"
                    maintain-aspect-ratio
                    tooltip
                />
            </div>
        </div>
        <FdpInspectorMap style="width: 100%; height: calc(100vh - 30px)" :filter="sectorFilter" />
    </v-main>
</template>

<script setup lang="ts">
import FdpInspectorMap from "@/components/fdp/FdpInspectorMap.vue"
import OccupancyChart from "@/components/fdp/OccupancyChart.vue"
import { useFdpStore } from "@/stores/fdp"
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue"
import moment from "moment"

const fdpStore = useFdpStore()
const fdp = computed(() => fdpStore.fdp)

const sectorFilter = ref("")
const sectorOptions = reactive([
    { title: "ALL", value: "" },
    { title: "APPW", value: "^APPW$" },
    { title: "APPE", value: "^APPE$" },
    { title: "TMA", value: "^(APPW|APPE|APPS)$" },
    { title: "TWR", value: "^SA_TWR.*" },
    { title: "GG_APP", value: "^(GGAPP.*)$" },
    { title: "GG_TWR", value: "^(GG_TWR|GG_GND)$" },
    { title: "ESMM", value: "^ESMM.*" },
    { title: "ESOS", value: "^ESOS.*" },
])

const sectors = computed(() =>
    fdp.value && fdp.value.sectors
        ? Object.keys(fdp.value.sectors).filter((id: string) =>
              id.match(new RegExp(`${sectorFilter.value}`)),
          )
        : [],
)

let subscription: any = undefined
onMounted(() => {
    subscription = fdpStore.subscribe()
})
onUnmounted(() => {
    if (subscription) fdpStore.unsubscribe(subscription)
    subscription = undefined
})
</script>
