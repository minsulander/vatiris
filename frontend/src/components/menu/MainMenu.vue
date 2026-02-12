<template>
    <v-btn
        v-if="!searching"
        type="icon"
        icon="mdi-magnify"
        class="text-grey"
        size="small"
        @click="clickSearch"
    />
    <v-combobox
        v-if="searching"
        v-model="searchText"
        :items="searchItems"
        :custom-filter="filterSearch"
        autofocus
        hide-details
        clearable
        clear-icon="mdi-close"
        placeholder="Search menu items"
        @keydown.esc="clearSearch"
        @keydown.enter="enterSearch"
        @blur="blurSearch"
        @update:search="changeSearch"
        style="width: 100%"
        density="compact"
    />

    <template v-if="!searching">
        <span style="max-width: 100%; white-space: nowrap; overflow: auto">
            <template v-for="(options, title) in authorizedMenuItems" :key="title">
                <v-btn
                    v-if="typeof options == 'string'"
                    type="text"
                    :color="options in windows.winbox ? '' : 'grey'"
                    @click="bus.emit('select', options)"
                    @contextmenu.prevent="bus.emit('unselect', options)"
                >
                    {{ title }}
                </v-btn>
                <v-btn v-else type="text" class="text-grey">
                    {{ title }}
                    <submenu :items="options" />
                </v-btn>
            </template>
        </span>
    </template>
</template>

<script setup lang="ts">
import Submenu from "@/components/menu/Submenu.vue"
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue"
import { useWindowsStore } from "@/stores/windows"
import { useDctStore } from "@/stores/dct"
import { useAuthStore } from "@/stores/auth"

const windows = useWindowsStore()
const dct = useDctStore()
const auth = useAuthStore()
const bus = useEventBus()

const authorizedMenuItems = computed(() => {
    const items = { ...menuItems }
    if (!auth.user) {
        delete items.Flight
        delete items.ATFM
        delete items.Documents
        delete items.Traffic
        delete items.ATS
        delete items.SECTORS
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
        WINDROSE: {
            // This will be filled in with ICAO codes
        } as { [key: string]: string },
        "METAR/TAF": "metartaf",
        SMHI: "smhi",
        "SWC NORDEN": "swc",
        VFR: "vfr",
        SUN: {
            // This will be filled in with ICAO codes
        } as { [key: string]: string },
    },
    // NOTAM: "notam", // disabled because broken
    eCharts: "echarts",
    Flight: {
        "ARR DEP": "arrdep",
    },
    ATFM: {
        ECFMP: "ECFMP",
    },
    Documents: {
        MANUAL: "wiki-vatiris",
        BULLETINS: "wiki-bulletins",
        CHECKLIST: {
            "Open position": "checklist-open-position",
            "Close position": "checklist-close-position",
            "Handover/takeover": "checklist-handover-takeover",
            "Runway change": "checklist-rwy-change",
        },
        QUICKREF: {
            "ESSA TWR": "quickref-essa-twr",
            "ESSA APP": "quickref-essa-app",
            "ESSB TWR": "quickref-essb-twr",
            "ESSB APP": "quickref-essb-app",
            "ESGG TWR": "quickref-esgg-twr",
            "ESGG APP": "quickref-esgg-app",
        },
        //Sweden: "https://wiki.vatsim-scandinavia.org/shelves/atc-sweden",
        //GEN: "https://wiki.vatsim-scandinavia.org/books/gen-k9C",
        GOP: {
            //Index: "https://wiki.vatsim-scandinavia.org/books/gop",
            "TWR/APP/AFIS": "wikipdf-gop-twr",
            ACC: "wiki-gop-acc",
            MIL: "wiki-gop-mil",
            "ATS-STRI": "wikipdf-gop-ats-stri",
        },
        LOP: {
            //Index: "https://wiki.vatsim-scandinavia.org/books/lop",
            RTC: "wiki-lop-rtc",
            "ESMM ACC": "wiki-lop-esmm-acc",
            "ESOS ACC": "wikipdf-lop-esos-acc",
            ESCF: "wiki-lop-escf",
            // ESCM // See Stockholm LPM
            ESDF: "wiki-lop-esdf",
            ESGG: "wiki-lop-esgg",
            "ESGG APP": "wiki-lop-esgg-app",
            ESGJ: "wiki-lop-esgj",
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
            ÖKC: "wiki-lop-okc",
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
        // QuickRef: {
        //     "ESGG TWR/APP": "wikipdf-quickref-esgg-twr-app",
        //     "ESSA TWR": "wikipdf-quickref-essa-twr",
        //     "ESSA APP": "wikipdf-quickref-essa-app",
        //     "ESSB TWR/APP": "wikipdf-quickref-essb-twr-app",
        // },
        // Events: {
        //     "Fly and see Santa 2024": "wiki-santa2024",
        // },
        AIP: {
            // filled in code
        },
        OTHER: {
            "ESSA PUSH": "SApush",
            "ESGG PUSH": "GGpush",
        },
        "CODES (ICAO)": {
            "AIRCRAFT TYPES": "aircrafttypes",
            CALLSIGNS: "callsigns",
            AERODROMES: "aerodromes",
        },
        "REGIONAL AD": "regional",
        "TEXT ALIAS": "alias",
        NOTEPAD: "notepad",
    },
    Traffic: {},
    ATS: "atcbookings",
    SECTORS: "sectors",
    DCT: {}, // We'll populate this dynamically
} as any)

import { metarAirports, wxAirports } from "@/metcommon"
import useEventBus from "@/eventbus"
import { useEaipStore } from "@/stores/eaip"

const eaip = useEaipStore()

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
    if (icao == "ESSA") {
        menuItems.MET.WINDROSE[icao + " ARR"] = `windrose${icao}`
        menuItems.MET.WINDROSE[icao + " DEP"] = `windrose${icao}DEP`
    } else {
        menuItems.MET.WINDROSE[icao] = `windrose${icao}`
    }
}

for (const [id, groups] of Object.entries(dct.menuItems)) {
    menuItems.DCT[id] = groups
}

function fillAip() {
    const aip = eaip.aipIndex
    if ("enroute" in aip) {
        menuItems.Documents.AIP["En-route kartor"] = {}
        for (const document of aip.enroute) {
            menuItems.Documents.AIP["En-route kartor"][document.name] =
                `aip${document.prefix.replaceAll(" ", "")}`
        }
    }
    if ("airports" in aip) {
        for (const airport of aip.airports) {
            menuItems.Documents.AIP[airport.icao] = {}
            for (const document of airport.documents) {
                menuItems.Documents.AIP[airport.icao][document.name] = `aip${document.prefix}`
            }
        }
    }
}

fillAip()
watch(eaip.aipIndex, fillAip, { deep: true })

import("@/data/occupancy-sectors.json").then((module) => {
    for (const id in module.default) {
        const entry = (module.default as any)[id]
        if (!(entry.section in menuItems.Traffic)) menuItems.Traffic[entry.section] = {}
        menuItems.Traffic[entry.section][entry.title] = `occupancy-${id}`
    }
})

const searchText = ref(undefined as any)
const searching = ref(false)

const searchItems = computed(() => {
    const flattenedItems: { title: string; value: string }[] = []

    const flattenMenu = (items: Record<string, any>, parentPath: string[] = []) => {
        for (const [key, value] of Object.entries(items)) {
            const currentPath = [...parentPath, key]

            if (typeof value === "string") {
                flattenedItems.push({
                    title: currentPath.join(" > "),
                    value,
                })
            } else if (typeof value === "object") {
                flattenMenu(value, currentPath)
            }
        }
    }

    flattenMenu(authorizedMenuItems.value)
    return flattenedItems
})

function filterSearch(value: string, searchTerm: string, item: any) {
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/)
    return searchWords.every((word) => item.title.toLowerCase().includes(word))
}

function clickSearch() {
    searching.value = true
}

function blurSearch() {
    setTimeout(() => {
        if (!document.activeElement?.classList.contains("v-list-item")) clearSearch()
    }, 100)
}

function clearSearch() {
    searchText.value = undefined
    searching.value = false
}

function enterSearch(e: Event) {
    if (typeof searchText.value != "string") return
    const match = searchItems.value.find((i) =>
        filterSearch(i.value, searchText.value as string, i),
    )
    if (match) bus.emit("select", match.value)
    clearSearch()
}

function changeSearch() {
    if (typeof searchText.value == "object") {
        const selected = searchText.value as any
        if (selected && selected.value) {
            bus.emit("select", selected.value)
            clearSearch()
        }
    }
}

onMounted(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (
            ((document.activeElement?.tagName != "INPUT" &&
                document.activeElement?.tagName != "TEXTAREA" &&
                !document.activeElement?.classList.contains("ql-editor") &&
                e.shiftKey) ||
                e.ctrlKey) &&
            (e.key === " " || e.key === "Enter")
        ) {
            e.preventDefault()
            clickSearch()
        }
    }

    window.addEventListener("keydown", handleKeyDown)

    onUnmounted(() => {
        window.removeEventListener("keydown", handleKeyDown)
    })
})
</script>
