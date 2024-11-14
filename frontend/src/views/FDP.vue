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
                <div v-else-if="fdp.general">{{ fdp.general.update_timestamp }}</div>
                <div v-if="fdp.flights">{{ Object.keys(fdp.flights).length }} flights {{ Object.keys(fdp.sectors).length }} sectors</div>
                <OccupancyChart/>
            </div>
        </div>
        <FdpInspectorMap style="width: 100%; height: calc(100vh - 30px)" />
    </v-main>
</template>

<script setup lang="ts">
import FdpInspectorMap from "@/components/fdp/FdpInspectorMap.vue"
import OccupancyChart from "@/components/fdp/OccupancyChart.vue";
import { useFdpStore } from "@/stores/fdp"
import { computed, onMounted, onUnmounted } from "vue"

const fdpStore = useFdpStore()

const fdp = computed(() => fdpStore.fdp)

let subscription: any = undefined
onMounted(() => {
    subscription = fdpStore.subscribe()
})
onUnmounted(() => {
    if (subscription) fdpStore.unsubscribe(subscription)
    subscription = undefined
})
</script>
