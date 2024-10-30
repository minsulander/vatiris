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
            <submenu :items="options" @select="select" @unselect="unselect" />
        </v-btn>
    </template>
</template>

<script setup lang="ts">
const emit = defineEmits(["select", "unselect"])

import Submenu from "@/components/menu/Submenu.vue"
import { reactive } from "vue"
import { useWindowsStore } from "@/stores/windows"
const windows = useWindowsStore()
const dct = useDctStore()

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
            Sweden: "https://wiki.vatsim-scandinavia.org/shelves/atc-sweden",
            GEN: "https://wiki.vatsim-scandinavia.org/books/gen-k9C",
            GOP: {
                Index: "https://wiki.vatsim-scandinavia.org/books/gop",
                "TWR/APP/AFIS": "https://wiki.vatsim-scandinavia.org/books/gop/page/gop-twrappafis",
                ACC: "https://wiki.vatsim-scandinavia.org/books/gop/page/gop-acc",
                MIL: "https://wiki.vatsim-scandinavia.org/books/gop/page/gop-mil",
                "ATS-STRI":
                    "https://wiki.vatsim-scandinavia.org/books/gop/page/cooperation-ats-stri",
            },
            LOP: {
                Index: "https://wiki.vatsim-scandinavia.org/books/lop",
                Appendices:
                    "https://wiki.vatsim-scandinavia.org/books/lop/page/quick-referencesappendices",
                RTC: "https://wiki.vatsim-scandinavia.org/books/lop/page/rtc",
                "ESMM ACC": "https://wiki.vatsim-scandinavia.org/books/lop/page/esmm-acc",
                "ESOS ACC": "https://wiki.vatsim-scandinavia.org/books/lop/page/esos-acc",
                // ESCF // TO BE ADDED
                // ESCM // See Stockholm LPM
                ESDF: "https://wiki.vatsim-scandinavia.org/books/lop/page/esdf",
                "ESDF APP": "https://wiki.vatsim-scandinavia.org/books/lop/page/esdf-app",
                ESGG: "https://wiki.vatsim-scandinavia.org/books/lop/page/esgg",
                "ESGG APP": "https://wiki.vatsim-scandinavia.org/books/lop/page/esgg-app",
                ESGJ: "https://wiki.vatsim-scandinavia.org/books/lop/page/esgj",
                ESGP: "https://wiki.vatsim-scandinavia.org/books/lop/page/esgp",
                ESGT: "https://wiki.vatsim-scandinavia.org/books/lop/page/esgt",
                ESIA: "https://wiki.vatsim-scandinavia.org/books/lop/page/esia",
                // ESIB // TO BE ADDED
                ESKM: "https://wiki.vatsim-scandinavia.org/books/lop/page/eskm",
                ESKN: "https://wiki.vatsim-scandinavia.org/books/lop/page/eskn",
                ESKS: "https://wiki.vatsim-scandinavia.org/books/lop/page/esks",
                ESMK: "https://wiki.vatsim-scandinavia.org/books/lop/page/esmk",
                ESMQ: "https://wiki.vatsim-scandinavia.org/books/lop/page/esmq",
                ESMS: "https://wiki.vatsim-scandinavia.org/books/lop/page/esms",
                ESMT: "https://wiki.vatsim-scandinavia.org/books/lop/page/esmt",
                ESMX: "https://wiki.vatsim-scandinavia.org/books/lop/page/esmx",
                ESND: "https://wiki.vatsim-scandinavia.org/books/lop/page/esnd",
                ESNG: "https://wiki.vatsim-scandinavia.org/books/lop/page/esng",
                ESNK: "https://wiki.vatsim-scandinavia.org/books/lop/page/esnk",
                ESNL: "https://wiki.vatsim-scandinavia.org/books/lop/page/esnl",
                ESNN: "https://wiki.vatsim-scandinavia.org/books/lop/page/esnn",
                ESNO: "https://wiki.vatsim-scandinavia.org/books/lop/page/esno",
                ESNQ: "https://wiki.vatsim-scandinavia.org/books/lop/page/esnq",
                ESNS: "https://wiki.vatsim-scandinavia.org/books/lop/page/esns",
                ESNU: "https://wiki.vatsim-scandinavia.org/books/lop/page/esnu",
                ESNV: "https://wiki.vatsim-scandinavia.org/books/lop/page/esnv",
                ESNX: "https://wiki.vatsim-scandinavia.org/books/lop/page/esnx",
                ESNZ: "https://wiki.vatsim-scandinavia.org/books/lop/page/esnz",
                ESOE: "https://wiki.vatsim-scandinavia.org/books/lop/page/esoe",
                ESOH: "https://wiki.vatsim-scandinavia.org/books/lop/page/esoh",
                ESOK: "https://wiki.vatsim-scandinavia.org/books/lop/page/esok",
                "ESOS APP": "https://wiki.vatsim-scandinavia.org/books/lop/page/esos-app",
                ESOW: "https://wiki.vatsim-scandinavia.org/books/lop/page/esow",
                ESPA: "https://wiki.vatsim-scandinavia.org/books/lop/page/espa",
                "ESPA APP": "https://wiki.vatsim-scandinavia.org/books/lop/page/espa-app",
                // ESPE // TO BE ADDED
                ESSA: "https://wiki.vatsim-scandinavia.org/books/lop/page/essa",
                ESSB: "https://wiki.vatsim-scandinavia.org/books/lop/page/essb",
                ESSD: "https://wiki.vatsim-scandinavia.org/books/lop/page/essd",
                ESSL: "https://wiki.vatsim-scandinavia.org/books/lop/page/essl",
                ESSP: "https://wiki.vatsim-scandinavia.org/books/lop/page/essp",
                ESST: "https://wiki.vatsim-scandinavia.org/books/lop/page/esst",
                ESSU: "https://wiki.vatsim-scandinavia.org/books/lop/page/essu",
                ESSV: "https://wiki.vatsim-scandinavia.org/books/lop/page/essv",
                "ESSV APP": "https://wiki.vatsim-scandinavia.org/books/lop/page/essv-app",
                ESTA: "https://wiki.vatsim-scandinavia.org/books/lop/page/esta",
                ESTL: "https://wiki.vatsim-scandinavia.org/books/lop/page/estl",
                ESUP: "https://wiki.vatsim-scandinavia.org/books/lop/page/esup",
                ESUT: "https://wiki.vatsim-scandinavia.org/books/lop/page/esut",
                ÖKC: "https://wiki.vatsim-scandinavia.org/books/lop/page/okc",
            },
            LoA: {
                Index: "https://wiki.vatsim-scandinavia.org/books/loa",
                EDWW: "https://wiki.vatsim-scandinavia.org/books/loa/page/bremen-firrhein-uir-sweden-fir",
                EKDK: "https://wiki.vatsim-scandinavia.org/books/loa/page/copenhagen-fir-sweden-fir",
                EFIN: "https://wiki.vatsim-scandinavia.org/books/loa/page/helsinki-fir-sweden-fir",
                UMKK: "https://wiki.vatsim-scandinavia.org/books/loa/page/kaliningrad-fir-sweden-fir",
                ENOR: "https://wiki.vatsim-scandinavia.org/books/loa/page/polaris-fir-sweden-fir",
                EVRR: "https://wiki.vatsim-scandinavia.org/books/loa/page/riga-fir-sweden-fir",
                EETT: "https://wiki.vatsim-scandinavia.org/books/loa/page/tallinn-fir-sweden-fir",
                EPWW: "https://wiki.vatsim-scandinavia.org/books/loa/page/warsaw-fir-sweden-fir",
            },
        },
        OTHER: {
            "ESSA PUSH": "SApush",
        },
        AIP: {
            // filled in code
        },
        "TEXT ALIAS": "alias",
        "AIRCRAFT TYPES": "aircraft",
        NOTEPAD: "notepad",
    },
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

import { useDctStore } from "@/stores/dct"

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

function select(id: string) {
    emit("select", id)
}

function unselect(id: string) {
    emit("unselect", id)
}
</script>
