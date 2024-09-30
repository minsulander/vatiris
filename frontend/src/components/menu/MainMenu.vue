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
            <v-menu activator="parent" transition="slide-y-transition">
                <v-list density="compact">
                    <v-list-item
                        v-for="(id, label) in options"
                        :class="(id as string) in windows.winbox ? '' : 'text-grey'"
                        :key="id as string"
                        @click="typeof id == 'string' ? emit('select', id) : undefined"
                    >
                        <v-list-item-title>{{ label }}</v-list-item-title>
                        <v-menu activator="parent" v-if="typeof id == 'object'" location="end">
                            <v-list density="compact">
                                <v-list-item
                                    v-for="(id2, label2) in id"
                                    :class="id2 in windows.winbox ? '' : 'text-grey'"
                                    :key="id2"
                                    @click="typeof id2 == 'string' ? emit('select', id2) : undefined"
                                >
                                    <v-list-item-title>{{ label2 }}</v-list-item-title>
                                    <v-menu
                                        activator="parent"
                                        v-if="typeof id2 == 'object'"
                                        location="end"
                                    >
                                        <v-list density="compact">
                                            <v-list-item
                                                v-for="(id3, label3) in id2"
                                                :class="id3 in windows.winbox ? '' : 'text-grey'"
                                                :key="id3"
                                                @click="emit('select', id3)"
                                            >
                                                <v-list-item-title>{{ label3 }}</v-list-item-title>
                                            </v-list-item>
                                        </v-list>
                                    </v-menu>
                                </v-list-item>
                            </v-list>
                        </v-menu>
                    </v-list-item>
                </v-list>
            </v-menu>
        </v-btn>
    </template>
</template>

<script setup lang="ts">
const emit = defineEmits(["select"])

import { useWindowsStore } from "@/stores/windows"
const windows = useWindowsStore()

const menuItems = {
    MET: {
        METREPORT: {
            // filled in code
        } as { [key: string]: string },
        METSENSOR: {
            // filled in code
        } as { [key: string]: string },
        SMHI: "smhi",
        "SWC NORDEN": "swc",
        VFR: "vfr",
    },

    NOTAM: "notam",
    eCharts: "echarts",
    ATFM: {
        ECFMP: "ECFMP",
    },
    Documents: {
        AIP: {
            // filled in code
        },
    },
}

import { wxAirports } from "@/stores/wx"

for (const icao of wxAirports) {
    menuItems.MET.METREPORT[icao] = `metrep${icao}`
    menuItems.MET.METSENSOR[icao] = `metsen${icao}`
}

import aipAirports from "@/data/aip-airports.json"
for (const airport of aipAirports) {
    menuItems.Documents.AIP[airport.icao] = {}
    for (const document of airport.documents) {
        menuItems.Documents.AIP[airport.icao][document.name] = `aip${document.prefix}`
    }
}
</script>
