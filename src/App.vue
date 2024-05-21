<template>
    <v-app>
        <v-app-bar color="#2b2d31" height="30">
            <template v-for="(options, title) in menuItems" :key="title">
                <v-btn
                    v-if="typeof options == 'string'"
                    type="text"
                    :color="options in windows.winbox ? '' : 'grey'"
                    @click="enable(options)"
                >
                    {{ title }}
                </v-btn>
                <v-btn v-else type="text" class="text-grey">
                    {{ title }}
                    <v-menu activator="parent" transition="slide-y-transition">
                        <v-list>
                            <v-list-item
                                v-for="(id, label) in options"
                                :class="id in windows.winbox ? '' : 'text-grey'"
                                :key="id"
                                @click="enable(id)"
                            >
                                <v-list-item-title>{{ label }}</v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </v-btn>
            </template>
            <v-spacer/>
            <v-btn class="text-grey" @click="enable('about')">About</v-btn>
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
            <Welcome v-if="!Object.values(windows.layout).find(l => l.enabled)"/>
        </v-main>
    </v-app>
</template>

<script setup lang="ts">
import { useWinBox } from "vue-winbox"
import Window from "@/components/Window.vue"
import Welcome from "@/components/Welcome.vue"
import Wx from "@/components/Wx.vue"
import Metreport from "./components/Metreport.vue"
import Metsensor from "./components/Metsensor.vue"
import Notam from "@/components/Notam.vue"
import LfvEcharts from "@/components/LfvEcharts.vue"
import Smhi from "@/components/Smhi.vue"
import About from "@/components/About.vue"
import { useWindowsStore } from "./stores/windows"
import { useWxStore } from "./stores/wx"
import { useNotamStore } from "./stores/notam"
import moment from "moment"

const menuItems = {
    /*
    "WX/AWOS": {
        // filled in code
    },
    */
    METREPORT: {
        // filled in code
    } as { [key: string]: string },
    METSENSOR: {
        // filled in code
    } as { [key: string]: string },
    NOTAM: "notam",
    SMHI: "smhi",
    eCharts: "echarts"
}

export interface WindowSpec {
    title: string
    component: any
    props?: any
    class?: string
    width: string | number
    height: string | number
}

const wxAirports = [ "ESSA", "ESSB", "ESOW", "ESGG", "ESGP", "ESGT", "ESGJ", "ESMS", "ESMK", "ESMQ", "ESMX", "ESOH", "ESOE", "ESOK", "ESSL", "ESKN", "ESKM", "ESNL", "ESND", "ESNX", "ESNK", "ESNV", "ESNG", "ESUP"]

const availableWindows: { [key: string]: WindowSpec } = {
    notam: {
        title: "NOTAM",
        component: Notam,
        width: 640,
        height: 640
    },
    echarts: {
        title: "LFV eCharts",
        component: LfvEcharts,
        width: 600,
        height: 600
    },
    smhi: {
        title: "SMHI",
        component: Smhi,
        width: 600,
        height: 600
    },
    about: {
        title: "About",
        component: About,
        width: 600,
        height: 240
    }
}

for (const icao of wxAirports) {
    /*
    menuItems["WX/AWOS"][icao] = `wx${icao}`
    availableWindows[`wx${icao}`] = { 
        title: `WX ${icao}`,
        component: Wx,
        props: { id: icao },
        width: 800,
        height: 500,
        class: "no-max"
    }
    */
    menuItems.METREPORT[icao] = `metrep${icao}`
    availableWindows[`metrep${icao}`] = {
        title: `METREPORT ${icao}`,
        component: Metreport,
        props: { id: icao },
        width: 360,
        height: 380,
        class: "no-max"
    }
    menuItems.METSENSOR[icao] = `metsen${icao}`
    availableWindows[`metsen${icao}`] = {
        title: `METSENSOR ${icao}`,
        component: Metsensor,
        props: { id: icao },
        width: 360,
        height: 380,
        class: "no-max"
    }
}

const winbox = useWinBox()
;(window as any).winbox = winbox

const windows = useWindowsStore()
;(window as any).windows = windows

const wx = useWxStore()
;(window as any).wx = wx

const notam = useNotamStore()
;(window as any).notam = notam

;(window as any).moment = moment

function enable(id: string) {
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
</script>
