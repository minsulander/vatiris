<template>
    <v-app-bar color="#2b2d31" height="30" elevation="0">
        <system-menu />
        <main-menu @select="select" @unselect="unselect" />
        <v-spacer />
        <main-toolbar />
    </v-app-bar>
    <v-main>
        <template v-for="(win, id) in availableWindows">
            <Window
                v-if="id in windows.layout && windows.layout[id].enabled"
                :key="id"
                :id="'' + id"
                :title="win.title"
                :width="win.width"
                :height="win.height"
                :class="win.class"
            >
                <component :is="win.component" v-bind="win.props" />
            </Window>
        </template>
        <Welcome v-if="!Object.values(windows.layout).find((l) => l.enabled)" />
    </v-main>
</template>

<script setup lang="ts">
import SystemMenu from "@/components/menu/SystemMenu.vue"
import MainMenu from "@/components/menu/MainMenu.vue"
import MainToolbar from "@/components/menu/MainToolbar.vue"
import Window from "@/components/Window.vue"
import Welcome from "@/components/Welcome.vue"
import Metreport from "@/components/met/Metreport.vue"
import MetsensorWX from "@/components/met/MetsensorWX.vue"
import Notam from "@/components/Notam.vue"
import LfvEcharts from "@/components/LfvEcharts.vue"
import Smhi from "@/components/met/Smhi.vue"
import Image from "@/components/Image.vue"
import ECFMP from "@/components/ECFMP.vue"
import SApush from "@/components/SApush.vue"
import Iframe from "@/components/Iframe.vue"
import DCT from "@/components/DCT.vue"
import Notepad from "@/components/Notepad.vue"
import Aircraft from "@/components/Aircraft.vue"
import Alias from "@/components/Alias.vue"
import Checklist from "@/components/Checklist.vue"
import MetarTaf from "@/components/met/MetarTaf.vue"
import Sun from "@/components/met/Sun.vue"
import Airport from "@/components/met/Airport.vue"
import WikiPage from "@/components/WikiPage.vue"
import WikiPdf from "@/components/WikiPdf.vue"
import { onBeforeUnmount, onUnmounted, shallowReactive } from "vue"
import { useWindowsStore } from "@/stores/windows"
import directsData from "@/data/dct/directs.json"
import { metarAirports, wxAirports } from "@/metcommon"
import GGpush from "@/components/GGpush.vue"

export interface WindowSpec {
    title: string
    component: any
    props?: any
    class?: string
    width: string | number
    height: string | number
}

const windows = useWindowsStore()

const availableWindows = shallowReactive({
    notam: {
        title: "NOTAM",
        component: Notam,
        width: 600,
        height: 600,
    },
    echarts: {
        title: "LFV eCharts",
        component: LfvEcharts,
        width: 600,
        height: 600,
    },
    smhi: {
        title: "SMHI",
        component: Smhi,
        width: 600,
        height: 600,
    },
    swc: {
        title: "SWC NORDEN",
        component: Image,
        props: { id: "swc", src: "https://aro.lfv.se/tor/nswc2aro.gif", refresh: "3600" },
        width: 480,
        height: 700,
    },
    vfr: {
        title: "VFR",
        component: Image,
        props: { id: "vfr", src: "https://aro.lfv.se/tor/vfrkarta.gif", refresh: "3610" },
        width: 400,
        height: 690,
    },
    ECFMP: {
        title: "ECFMP Flow Measures",
        component: ECFMP,
        width: 700,
        height: 300,
    },
    SApush: {
        title: "ESSA Pushback",
        component: SApush,
        width: 700,
        height: 600,
    },
    aircraft: {
        title: "Aircraft Types ICAO",
        component: Aircraft,
        width: 605,
        height: 400,
    },
    notepad: {
        title: "NOTEPAD",
        component: Notepad,
        width: 400,
        height: 500,
    },
    metartaf: {
        title: "METAR/TAF",
        component: MetarTaf,
        width: 700,
        height: 500,
    },
    alias: {
        title: "Text Alias",
        component: Alias,
        width: 650,
        height: 750,
    },
    wikitest: {
        title: "WIKI TEST",
        component: WikiPdf,
        props: { id: 120 },
        width: 800,
        height: 600,
    },
    wikitest2: {
        title: "WIKI TEST 2",
        component: WikiPage,
        props: { book: "lop", page: "esgt" },
        width: 800,
        height: 600,
    },
    GGpush: {
        title: "ESGG Pushback",
        component: GGpush,
        width: 575,
        height: 895,
        class: "no-max",
    },

} as any)

for (const icao of metarAirports) {
    if (icao == "ESSA") {
        availableWindows[`metrep${icao}arr`] = {
            title: `METREPORT ${icao} ARR`,
            component: Metreport,
            props: { id: icao, type: "ARR" },
            width: 420,
            height: 380,
            class: "no-max",
        }
        availableWindows[`metrep${icao}dep`] = {
            title: `METREPORT ${icao} DEP`,
            component: Metreport,
            props: { id: icao, type: "DEP" },
            width: 420,
            height: 380,
            class: "no-max",
        }
    }
    availableWindows[`metrep${icao}`] = {
        title: `METREPORT ${icao}`,
        component: Metreport,
        props: { id: icao },
        width: 420,
        height: 380,
        class: "no-max",
    }
}
for (const icao of wxAirports) {
    availableWindows[`metsen${icao}`] = {
        title: `METSENSOR ${icao}`,
        component: MetsensorWX,
        props: { id: icao },
        width: 360,
        height: 380,
        class: "no-max",
    }
}
for (const icao of metarAirports) {
    availableWindows[`sun${icao}`] = {
        title: `SUN ${icao}`,
        component: Sun,
        props: { id: icao },
        width: 340,
        height: 155,
        class: "no-max",
    }
}
for (const icao of wxAirports) {
    availableWindows[`airport${icao}`] = {
        title: `${icao}`,
        component: Airport,
        props: { id: icao },
        width: 380,
        height: 900,
        class: "no-max",
    }
}

import("@/data/aip-airports.json").then((module) => {
    for (const airport of module.default) {
        for (const document of airport.documents) {
            availableWindows[`aip${document.prefix}`] = {
                title: `AIP ${document.prefix} ${document.name}`,
                component: Iframe,
                props: { src: `${document.url}#toolbar=0` },
                width: 800,
                height: 600,
            }
        }
    }
})

import("@/data/wiki-pdfs.json").then((module) => {
    for (const id in module.default) {
        const pdf = (module.default as any)[id]
        availableWindows[`wikipdf-${id}`] = {
            title: pdf.title,
            component: WikiPdf,
            props: { id: pdf.attachmentId },
            width: 800,
            height: 600,
        }
    }
})
import("@/data/wiki-pages.json").then((module) => {
    for (const id in module.default) {
        const page = (module.default as any)[id]
        availableWindows[`wiki-${id}`] = {
            title: page.title,
            component: WikiPage,
            props: { book: page.book, page: page.page },
            width: 800,
            height: 600,
        }
    }
})

for (const name of ["open-position", "close-position", "handover-takeover", "rwy-change"]) {
    import(`@/data/checklist/${name}.json`).then((module) => {
        const checklist = module.default
        availableWindows[`checklist-${name}`] = {
            title: `Checklist - ${checklist.title}`,
            component: Checklist,
            props: { id: name, checklist },
            width: checklist.width || 600,
            height: checklist.height || 700,
        }
    })
}

for (const direct of directsData) {
    const id = direct.id.toLowerCase().replace(/\s+/g, "-")
    availableWindows[`coord-${id}`] = {
        title: `${direct.id} Directs`,
        component: DCT,
        props: { id: direct.id },
        width: 550,
        height: 700,
    }
}

function select(id: string | object) {
    let ctrl = false
    if (typeof id == "string" && id.startsWith("ctrl+")) {
        ctrl = true
        id = id.substr(5)
    }
    if (typeof id == "object") {
        // submenu
    } else if (id in availableWindows) {
        if (id in windows.winbox) {
            if (windows.winbox[id].min) windows.winbox[id].restore()
            windows.winbox[id].focus()
        } else {
            if (ctrl && availableWindows[id].props && availableWindows[id].props.src) {
                // ctrl-click on image/iframe opens in new tab
                window.open(availableWindows[id].props.src, "_blank")
            } else if (id in windows.layout) {
                windows.layout[id].enabled = true
            } else {
                windows.layout[id] = { enabled: true }
            }
        }
    } else if (id.startsWith && id.startsWith("https://")) {
        const [url, target] = id.split("|")
        window.open(url, target || "_blank")
    } else {
        console.error(`Unknown menu selection: ${id}`)
    }
}

function unselect(id: string) {
    console.log("unselect", id)
    if (id in windows.winbox) {
        windows.winbox[id].close()
    }
}

onBeforeUnmount(() => {
    windows.unmounting = true
})

onUnmounted(() => {
    windows.unmounting = false
})
;(window as any).select = select
</script>
