<template>
    <template v-for="(options, title) in menuItems" :key="title">
        <v-btn
            v-if="typeof options == 'string'"
            type="text"
            :color="options in windows.winbox ? '' : 'grey'"
            @click="emit('select', options)"
        >
            {{ title }}
        </v-btn>
        <v-btn v-else type="text" class="text-grey">
            {{ title }}
            <submenu :items="options" @select="select"/>
        </v-btn>
    </template>
</template>

<script setup lang="ts">
const emit = defineEmits(["select"])

import Submenu from "@/components/menu/Submenu.vue"
import { useWindowsStore } from "@/stores/windows"
const windows = useWindowsStore()

import Full from "@/components/Full.vue"

const menuItems = {
    MET: {
        FULL: {
            // This will be filled in with ICAO codes
        } as { [key: string]: string },
        METREPORT: {
            // filled in code
        } as { [key: string]: string },
        METSENSOR: {
            // filled in code
        } as { [key: string]: string },
        SMHI: "smhi",
        "SWC NORDEN": "swc",
        VFR: "vfr",
        SUN: {
            // This will be filled in with ICAO codes
        } as { [key: string]: string },
    },
    NOTAM: "notam",
    eCharts: "echarts",
    ATFM: {
        ECFMP: "ECFMP",
    },
    Documents: {
        WIKI: {
            Sweden: "link|https://wiki.vatsim-scandinavia.org/shelves/atc-sweden|wiki",
            GEN: "link|https://wiki.vatsim-scandinavia.org/books/gen-k9C|wiki",
            GOP: "link|https://wiki.vatsim-scandinavia.org/books/gop|wiki",
            LOP: "link|https://wiki.vatsim-scandinavia.org/books/lop|wiki",
            LoA: "link|https://wiki.vatsim-scandinavia.org/books/loa|wiki",
        },
        AIP: {
            // filled in code
        },
    },
} as any

import { wxAirports } from "@/stores/wx"

for (const icao of wxAirports) {
    menuItems.MET.FULL[icao] = `full${icao}`
    menuItems.MET.METREPORT[icao] = `metrep${icao}`
    menuItems.MET.METSENSOR[icao] = `metsen${icao}`
     menuItems.MET.SUN[icao] = `sun${icao}`
}

import aipAirports from "@/data/aip-airports.json"
for (const airport of aipAirports) {
    menuItems.Documents.AIP[airport.icao] = {}
    for (const document of airport.documents) {
        menuItems.Documents.AIP[airport.icao][document.name] = `aip${document.prefix}`
    }
}

function select(id: string) {
    emit("select", id)
}
</script>
