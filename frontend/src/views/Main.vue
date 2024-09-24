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
    /*
    aip: {
        title: "AIP test",
        component: Iframe,
        props: { src: "https://www.aro.lfv.se/Editorial/View/13845/ES_AD_2_ESSA_5-23_en#toolbar=0&navpanes=0&scrollbar=0" },
        width: 800,
        height: 600,
    },
    */
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
        width: 600,
        height: 300,
    },

    about: {
        title: "About",
        component: About,
        width: 600,
        height: 240,
    },
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

function select(id: string) {
    if (!(id in availableWindows)) console.error(`Unknown window ${id}`)
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
}

onBeforeUnmount(() => {
    windows.unmounting = true
})

onUnmounted(() => {
    windows.unmounting = false
})
</script>
