<template>
    <div style="height: 25px; margin-top: -5px; margin-left: -5px; background: #777">
        <v-btn
            variant="text"
            rounded="0"
            size="small"
            :color="arr ? 'white' : 'grey-lighten-1'"
            @click="arr = !arr"
            >ARR</v-btn
        >
        <v-btn
            variant="text"
            rounded="0"
            size="small"
            :color="dep ? 'white' : 'grey-lighten-1'"
            @click="dep = !dep"
            >DEP</v-btn
        >
        <v-btn variant="text" rounded="0" size="small" color="white" @click="adFilter = ''"
            >Aerodromes
            <v-menu
                activator="parent"
                transition="slide-y-transition"
                :close-on-content-click="false"
            >
                <v-list density="compact">
                    <v-list-item @click="clickAdNone" :class="ad.length == 0 ? '' : 'text-grey'">
                        <v-list-item-title>ALL</v-list-item-title>
                    </v-list-item>
                    <v-list-item>
                        <v-text-field
                            v-model="adFilter"
                            variant="underlined"
                            density="compact"
                            hide-details
                            autofocus
                            clearable
                            clear-icon="mdi-close"
                            @keydown.esc="filterEsc"
                            @keydown.enter.stop="filterEnter"
                        />
                    </v-list-item>
                    <v-list-item
                        v-for="id in filteredAd"
                        :key="id"
                        :class="ad.includes(id) ? '' : 'text-grey'"
                        @click="clickAd(id)"
                    >
                        <v-list-item-title>{{ id }}</v-list-item-title>
                    </v-list-item>
                </v-list>
            </v-menu>
        </v-btn>
    </div>
    <div class="d-flex" style="height: calc(100% - 25px)">
        <div
            v-if="arr"
            class="flex-1-0"
            style="min-height: 0; max-height: 100%; overflow: auto"
            :style="{ 'max-width': dep ? '50%' : '100%' }"
        >
            <!--
            <div
                class="text-center"
                style="position: sticky; top: 0; background: white; border-bottom: 1px solid #ccc"
            >
                Arrivals
            </div>
            -->
            <arrival-list style="border-right: 1px solid #ccc" :airports="ad" />
        </div>
        <div v-if="dep" class="flex-1-0" style="min-height: 0; max-height: 100%; overflow: auto">
            <!--
            <div
                class="text-center"
                style="position: sticky; top: 0; background: white; border-bottom: 1px solid #ccc"
            >
                Departures
            </div>
            -->
            <departure-list style="border-left: 1px solid #ccc" :airports="ad" />
        </div>
    </div>
</template>

<script setup lang="ts">
import ArrivalList from "./ArrivalList.vue"
import DepartureList from "./DepartureList.vue"
import { reactive, ref, computed, onMounted, onUnmounted, watch } from "vue"
import { useAirportStore } from "@/stores/airport"

const airportStore = useAirportStore()
const arr = ref(true)
const dep = ref(true)
const ad = reactive([] as string[])
const adFilter = ref("")

const filteredAd = computed(() => {
    if (adFilter.value) {
        const lower = adFilter.value.toLowerCase()
        return Object.keys(airportStore.airports)
            .filter((id) => id.toLowerCase().includes(lower))
            .sort()
    }
    return Object.keys(airportStore.airports).sort()
})

function clickAd(icao: string) {
    if (ad.includes(icao)) {
        ad.splice(ad.indexOf(icao), 1)
    } else {
        ad.push(icao)
    }
}

function clickAdNone() {
    ad.splice(0)
}

function filterEsc(e: KeyboardEvent) {
    if (adFilter.value.length > 0) {
        adFilter.value = ""
        e.stopPropagation()
    }
}

function filterEnter() {
    if (filteredAd.value.length == 1) {
        clickAd(filteredAd.value[0])
    } else if (adFilter.value.length == 4) {
        clickAd(adFilter.value.toUpperCase())
    }
}

onMounted(() => {
    loadOptions()
})

watch([arr, dep, ad], () => {
    saveOptions()
})

function loadOptions() {
    if ("arrdepOptions" in localStorage) {
        const options = JSON.parse(localStorage.arrdepOptions)
        arr.value = options.arr
        dep.value = options.dep
        ad.splice(0)
        for (const id of options.ad) ad.push(id)
    }
}

function saveOptions() {
    localStorage.arrdepOptions = JSON.stringify({
        arr: arr.value,
        dep: dep.value,
        ad,
    })
}
</script>
