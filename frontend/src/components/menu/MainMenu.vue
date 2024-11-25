<template>
    <template v-for="(options, title) in authorizedMenuItems" :key="title">
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
            <submenu :items="options" @select="select" @unselect="unselect" />
        </v-btn>
    </template>
</template>

<script setup lang="ts">
const emit = defineEmits(["select", "unselect"])

import Submenu from "@/components/menu/Submenu.vue"
import { computed, reactive } from "vue"
import { useWindowsStore } from "@/stores/windows"
import { useDctStore } from "@/stores/dct"
import { useAuthStore } from "@/stores/auth"

const windows = useWindowsStore()
const dct = useDctStore()
const auth = useAuthStore()

const authorizedMenuItems = computed(() => {
    const items = { ...menuItems }
    if (!auth.user) {
        delete items.ATFM
        delete items.Documents
        delete items.Traffic
        delete items.DCT
    }
    return items
})

const menuItems = reactive({
    MET: {
        AIRPORT: {
            // This will be filled in with ICAO codes
        } as { [key: string]: string },
        METREPORT: {
            // filled in code
        } as { [key: string]: string },
        METSENSOR: {
            // filled in code
        } as { [key: string]: string },
        "METAR/TAF": "metartaf",
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
        CHECKLIST: {
            "Open position": "checklist-open-position",
            "Close position": "checklist-close-position",
            "Handover/takeover": "checklist-handover-takeover",
            "Runway change": "checklist-rwy-change",
        },
        WIKI: {
            //Sweden: "https://wiki.vatsim-scandinavia.org/shelves/atc-sweden",
            //GEN: "https://wiki.vatsim-scandinavia.org/books/gen-k9C",
            GOP: {
                //Index: "https://wiki.vatsim-scandinavia.org/books/gop",
                "TWR/APP/AFIS": "wikipdf-gop-twr",
                ACC: "wikipdf-gop-acc",
                MIL: "wiki-gop-mil",
                "ATS-STRI": "wikipdf-gop-ats-stri",
            },
            LOP: {
                //Index: "https://wiki.vatsim-scandinavia.org/books/lop",
                RTC: "wiki-lop-rtc",
                "ESMM ACC": "wikipdf-lop-esmm-acc",
                "ESOS ACC": "wikipdf-lop-esos-acc",
                ESCF: "wiki-lop-escf",
                // ESCM // See Stockholm LPM
                ESDF: "wiki-lop-esdf",
                ESGG: "wikipdf-lop-esgg",
                "ESGG APP": "wikipdf-lop-esgg-app",
                ESGJ: "wiki-lop-esgj",
                ESGP: "wiki-lop-esgp",
                ESGT: "wiki-lop-esgt",
                ESIA: "wiki-lop-esia",
                ESIB: "wiki-lop-esib",
                ESKM: "wiki-lop-eskm",
                ESKN: "wiki-lop-eskn",
                ESKS: "wiki-lop-esks",
                ESMK: "wiki-lop-esmk",
                ESMQ: "wiki-lop-esmq",
                ESMS: "wiki-lop-esms",
                ESMT: "wiki-lop-esmt",
                ESMX: "wiki-lop-esmx",
                ESND: "wiki-lop-esnd",
                ESNG: "wiki-lop-esng",
                ESNK: "wiki-lop-esnk",
                ESNL: "wiki-lop-esnl",
                ESNN: "wiki-lop-esnn",
                ESNO: "wiki-lop-esno",
                ESNQ: "wiki-lop-esnq",
                ESNS: "wiki-lop-esns",
                ESNU: "wiki-lop-esnu",
                ESNV: "wiki-lop-esnv",
                ESNX: "wiki-lop-esnx",
                ESNZ: "wiki-lop-esnz",
                ESOE: "wiki-lop-esoe",
                ESOH: "wiki-lop-esoh",
                ESOK: "wiki-lop-esok",
                "ESOS APP": "wikipdf-lpm-esos",
                ESOW: "wikipdf-lpm-esos",
                ESPA: "wiki-lop-espa",
                ESPE: "wiki-lop-espe",
                ESSA: "wikipdf-lpm-esos",
                ESSB: "wikipdf-lpm-esos",
                ESSD: "wiki-lop-essd",
                ESSL: "wiki-lop-essl",
                ESSP: "wiki-lop-essp",
                ESST: "wiki-lop-esst",
                ESSU: "wiki-lop-essu",
                ESSV: "wiki-lop-essv",
                ESTA: "wiki-lop-esta",
                ESTL: "wiki-lop-estl",
                ESUP: "wiki-lop-esup",
                ESUT: "wiki-lop-esut",
                ÖKC: "wikipdf-lop-okc",
            },
            LoA: {
                //Index: "https://wiki.vatsim-scandinavia.org/books/loa",
                EDWW: "wikipdf-loa-edww",
                EKDK: "wikipdf-loa-ekdk",
                EFIN: "wikipdf-loa-efin",
                UMKK: "wikipdf-loa-umkk",
                ENOR: "wikipdf-loa-enor",
                EVRR: "wikipdf-loa-evrr",
                EETT: "wikipdf-loa-eett",
                EPWW: "wikipdf-loa-epww",
            },
            QuickRef: {
                "ESGG TWR/APP": "wikipdf-quickref-esgg-twr-app",
                "ESSA TWR": "wikipdf-quickref-essa-twr",
                "ESSA APP": "wikipdf-quickref-essa-app",
                "ESSB TWR/APP": "wikipdf-quickref-essb-twr-app",
            },
        },
        OTHER: {
            "ESSA PUSH": "SApush",
            "ESGG PUSH": "GGpush",
        },
        AIP: {
            // filled in code
        },
        "TEXT ALIAS": "alias",
        "AIRCRAFT TYPES": "aircraft",
        NOTEPAD: "notepad",
    },
    Traffic: {},
    DCT: {}, // We'll populate this dynamically
} as any)

import { metarAirports, wxAirports } from "@/metcommon"

for (const icao of wxAirports) {
    menuItems.MET.AIRPORT[icao] = `airport${icao}`
    menuItems.MET.METSENSOR[icao] = `metsen${icao}`
}

for (const icao of metarAirports) {
    menuItems.MET.METREPORT[icao] = `metrep${icao}`
    if (icao == "ESSA") {
        menuItems.MET.METREPORT[`${icao} ARR`] = `metrep${icao}arr`
        menuItems.MET.METREPORT[`${icao} DEP`] = `metrep${icao}dep`
    }
    menuItems.MET.SUN[icao] = `sun${icao}`
}

for (const [id, groups] of Object.entries(dct.menuItems)) {
    menuItems.DCT[id] = groups
}

import("@/data/aip-airports.json").then((module) => {
    for (const airport of module.default) {
        menuItems.Documents.AIP[airport.icao] = {}
        for (const document of airport.documents) {
            menuItems.Documents.AIP[airport.icao][document.name] = `aip${document.prefix}`
        }
    }
})

import("@/data/occupancy-sectors.json").then((module) => {
    for (const id in module.default) {
        const entry = (module.default as any)[id]
        if (!(entry.section in menuItems.Traffic)) menuItems.Traffic[entry.section] = {}
        menuItems.Traffic[entry.section][entry.title] = `occupancy-${id}`
    }
})

function select(id: string) {
    emit("select", id)
}

function unselect(id: string) {
    emit("unselect", id)
}
</script>
