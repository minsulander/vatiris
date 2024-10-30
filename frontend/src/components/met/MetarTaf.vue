<template>
    <div style="height: 30px; background: #666">
        <v-btn
            variant="text"
            rounded="0"
            size="small"
            :color="metar ? 'white' : 'grey-lighten-1'"
            @click="metar = !metar"
            >METAR</v-btn
        >
        <v-btn
            variant="text"
            rounded="0"
            size="small"
            :color="taf ? 'white' : 'grey-lighten-1'"
            @click="taf = !taf"
            >TAF</v-btn
        >
        <v-btn variant="text" rounded="0" size="small" color="white" @click="adFilter = ''"
            >Aerodromes
            <v-menu
                activator="parent"
                transition="slide-y-transition"
                :close-on-content-click="false"
            >
                <v-list density="compact">
                    <v-list-item
                        @click="clickAdAll"
                        :class="ad.length == metarAirports.length ? '' : 'text-grey'"
                    >
                        <v-list-item-title>ALL</v-list-item-title>
                    </v-list-item>
                    <v-list-item @click="clickAdNone" :class="ad.length == 0 ? '' : 'text-grey'">
                        <v-list-item-title>NONE</v-list-item-title>
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
    <div style="font-size: 14px; line-height: 16px; height: calc(100% - 30px); overflow-y: auto">
        <div class="ma-1" v-if="ad.length == 0">Select aerodromes in the menu above.</div>
        <div class="ma-1" v-if="!metar && !taf">Both METAR and TAF unselected...</div>
        <div class="ma-1" v-for="icao in ad" :key="icao">
            <pre v-if="metar && metarStore.metar[icao].length == 0" class="text-grey"
                >{{ icao }} N/A</pre
            >
            <pre v-else-if="metar">{{ metarStore.metar[icao] }}</pre>
            <pre v-else-if="taf && !metar && tafStore.taf[icao].length == 0" class="text-grey">
TAF {{ icao }} N/A</pre
            >
            <pre v-if="taf" :class="metar ? 'mb-2 text-grey-darken-2' : ''">{{
                tafStore.taf[icao]
            }}</pre>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useMetarStore } from "@/stores/metar"
import { useTafStore } from "@/stores/taf"
import { metarAirports } from "@/metcommon";
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue"

const metarStore = useMetarStore()
const tafStore = useTafStore()

const metar = ref(true)
const taf = ref(true)
const ad = reactive([] as string[])

const adFilter = ref("")

const filteredAd = computed(() => {
    const airports = metarAirports
    if (adFilter.value) {
        const lower = adFilter.value.toLowerCase()
        return airports.filter((id) => id.toLowerCase().includes(lower)).sort()
    }
    return airports.sort()
})

function clickAd(icao: string) {
    if (ad.includes(icao)) {
        ad.splice(ad.indexOf(icao), 1)
        unsubscribe(icao)
    } else {
        ad.push(icao)
        subscribe(icao)
    }
}

function clickAdAll() {
    for (const icao of metarAirports) {
        if (!(icao in ad)) {
            ad.push(icao)
            subscribe(icao)
        }
    }
}

function clickAdNone() {
    ad.splice(0)
    unsubscribeAll()
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

let metarSubscriptions: { [key: string]: string } = {}
let tafSubscriptions: { [key: string]: string } = {}

onMounted(() => {
    loadOptions()
    for (const icao of ad) subscribe(icao)
})

onUnmounted(() => {
    unsubscribeAll()
})

watch([metar, taf, ad], () => {
    saveOptions()
})

function loadOptions() {
    if ("metartafOptions" in localStorage) {
        const options = JSON.parse(localStorage.metartafOptions)
        metar.value = options.metar
        taf.value = options.taf
        ad.splice(0)
        for (const id of options.ad) ad.push(id)
    }
}

function saveOptions() {
    localStorage.metartafOptions = JSON.stringify({
        metar: metar.value,
        taf: taf.value,
        ad,
    })
}

watch(metar, () => {
    if (metar.value) {
        for (const icao of ad) subscribe(icao)
    } else {
        for (const subscription of Object.values(metarSubscriptions))
            metarStore.unsubscribe(subscription)
        for (const icao in metarSubscriptions) delete metarSubscriptions[icao]
    }
})

watch(taf, () => {
    if (taf.value) {
        for (const icao of ad) subscribe(icao)
    } else {
        for (const subscription of Object.values(tafSubscriptions))
            tafStore.unsubscribe(subscription)
        for (const icao in tafSubscriptions) delete tafSubscriptions[icao]
    }
})

function subscribe(icao: string) {
    if (metar.value && !(icao in metarSubscriptions))
        metarSubscriptions[icao] = metarStore.subscribe(icao)
    if (taf.value && !(icao in tafSubscriptions)) tafSubscriptions[icao] = tafStore.subscribe(icao)
}

function unsubscribe(icao: string) {
    if (icao in metarSubscriptions) {
        metarStore.unsubscribe(metarSubscriptions[icao])
        delete metarSubscriptions[icao]
    }
    if (icao in tafSubscriptions) {
        tafStore.unsubscribe(tafSubscriptions[icao])
        delete tafSubscriptions[icao]
    }
}

function unsubscribeAll() {
    for (const subscription of Object.values(metarSubscriptions))
        metarStore.unsubscribe(subscription)
    for (const icao in metarSubscriptions) delete metarSubscriptions[icao]
    for (const subscription of Object.values(tafSubscriptions)) tafStore.unsubscribe(subscription)
    for (const icao in tafSubscriptions) delete tafSubscriptions[icao]
}
</script>
