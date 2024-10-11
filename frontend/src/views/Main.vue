<template>
    <v-app-bar color="#2b2d31" height="30" elevation="0">
        <system-menu />
        <main-menu @select="select" />
        <v-spacer />
        <main-toolbar />
    </v-app-bar>
    <v-main>
        <template v-for="(win, id) in availableWindows">
            <Window
                v-if="id in windows.layout && windows.layout[id].enabled"
                :key="id"
                :id="id as string"
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
import Metreport from "@/components/Metreport.vue"
import Metsensor from "@/components/Metsensor.vue"
import Notam from "@/components/Notam.vue"
import LfvEcharts from "@/components/LfvEcharts.vue"
import Smhi from "@/components/Smhi.vue"
import About from "@/components/About.vue"
import Image from "@/components/Image.vue"
import ECFMP from "@/components/ECFMP.vue"
import Iframe from "@/components/Iframe.vue"
import Sun from "@/components/Sun.vue"
import Full from "@/components/Full.vue"

import { onBeforeUnmount, onUnmounted } from "vue"
import { useWindowsStore } from "@/stores/windows"

const windows = useWindowsStore()

import { wxAirports } from "@/stores/wx"

export interface WindowSpec {
    title: string
    component: any
    props?: any
    class?: string
    width: string | number
    height: string | number
}

const availableWindows: { [key: string]: WindowSpec } = {
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
    Sun: {
        title: "Sunrise/Sunset Times",
        component: Sun,
        width: 300,
        height: 200,
    },
    ECFMP: {
        title: "ECFMP Flow Measures",
        component: ECFMP,
        width: 600,
        height: 300,
    },

    about: {
        title: "About",
        component: About,
        width: 600,
        height: 240,
    },
    Sun: {
        title: "Sunrise/Sunset Times",
        component: Sun,
        width: 300,
        height: 200,
    },
    // .
}

for (const icao of wxAirports) {
    availableWindows[`metrep${icao}`] = {
        title: `METREPORT ${icao}`,
        component: Metreport,
        props: { id: icao },
        width: 420,
        height: 380,
        class: "no-max",
    }
    availableWindows[`metsen${icao}`] = {
        title: `METSENSOR ${icao}`,
        component: Metsensor,
        props: { id: icao },
        width: 360,
        height: 380,
        class: "no-max",
        
    }
}
for (const icao of wxAirports) {
    availableWindows[`sun${icao}`] = {
        title: `SUN ${icao}`,
        component: Sun,
        props: { id: icao },
        width: 300,
        height: 200,
        class: "no-max",
    }
}

import aipAirports from "@/data/aip-airports.json"
for (const airport of aipAirports) {
    for (const document of airport.documents) {
        availableWindows[`aip${document.prefix}`] = {
            title: `AIP ${document.prefix} ${document.name}`,
            component: Iframe,
            props: { src: `${document.url}#toolbar=0` },
            width: 500,
            height: 700,
        }
    }
}

function select(id: string | object) {
    if (typeof id == 'object') {
        // submenu
    } else if (id in availableWindows) {
        if (id in windows.winbox) {
            if (windows.winbox[id].min) windows.winbox[id].restore()
            windows.winbox[id].focus()
        } else {
            if (id in windows.layout) {
                windows.layout[id].enabled = true
            } else {
                windows.layout[id] = { enabled: true }
            }
        }
    } else if (id.startsWith && id.startsWith("link")) {
        const [_, url, target] = id.split("|")
        window.open(url, target || "_blank")
    } else {
        console.error(`Unknown menu selection: ${id}`)
    }
}

onBeforeUnmount(() => {
    windows.unmounting = true
})

onUnmounted(() => {
    windows.unmounting = false
})
;(window as any).select = select

// Add this loop after the existing loops
const fullViewAirports = ["ESGG", "ESMS", "ESSA", "ESSL"];
for (const icao of fullViewAirports) {
    availableWindows[`full${icao}`] = {
        title: `ALL ${icao}`,
        component: Full,
        props: { id: icao },
        width: 600,
        height: 800,
        class: "no-max",
    }
}
</script>
