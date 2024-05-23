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
                                :class="(id as string) in windows.winbox ? '' : 'text-grey'"
                                :key="id as string"
                                @click="typeof id == 'string' ? enable(id) : undefined"
                            >
                                <v-list-item-title>{{ label }}</v-list-item-title>
                                <v-menu
                                    activator="parent"
                                    v-if="typeof id == 'object'"
                                    location="end"
                                >
                                    <v-list>
                                        <v-list-item
                                            v-for="(id2, label2) in id"
                                            :class="id2 in windows.winbox ? '' : 'text-grey'"
                                            :key="id2"
                                            @click="enable(id2)"
                                        >
                                            <v-list-item-title>{{ label2 }}</v-list-item-title>
                                        </v-list-item>
                                    </v-list>
                                </v-menu>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </v-btn>
            </template>
            <v-spacer />
            <v-btn class="text-grey" @click="enable('about')">About</v-btn>
            <v-btn
                v-if="!fullscreen"
                type="icon"
                icon="mdi-fullscreen"
                class="text-grey"
                @click="requestFullScreen"
            ></v-btn>
            <v-btn
                v-if="fullscreen"
                type="icon"
                icon="mdi-fullscreen-exit"
                class="text-grey"
                @click="exitFullScreen"
            ></v-btn>
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
                <!--
                <Window id="iframe" title="IFRAME" width="800" height="600">
                    <Iframe src="https://www.aro.lfv.se/Editorial/View/General/14387/Daily%20use%20plan%202024-05-23%20version%203" />
                </Window>
                -->
        </v-main>
    </v-app>
</template>

<script setup lang="ts">
import Window from "@/components/Window.vue"
import Welcome from "@/components/Welcome.vue"
import Wx from "@/components/Wx.vue"
import Metreport from "./components/Metreport.vue"
import Metsensor from "./components/Metsensor.vue"
import Notam from "@/components/Notam.vue"
import LfvEcharts from "@/components/LfvEcharts.vue"
import Smhi from "@/components/Smhi.vue"
import About from "@/components/About.vue"
import Image from "@/components/Image.vue"
import Iframe from "@/components/Iframe.vue"

import { useWinBox } from "vue-winbox"
import { useWindowsStore } from "./stores/windows"
import { useWxStore } from "./stores/wx"
import { useNotamStore } from "./stores/notam"
import moment from "moment"
import axios from "axios"
import { onMounted, ref } from "vue"

const menuItems = {
    /*
    menu: {
        submenu: {
            "Item 1": "item1",
            "Item 2": "item2"
        },
    },
    */
    MET: {
        METREPORT: {
            // filled in code
        } as { [key: string]: string },
        METSENSOR: {
            // filled in code
        } as { [key: string]: string },
        /*
        "WX/AWOS": {
            // filled in code
        } as { [key: string]: string },
        */
        SMHI: "smhi",
        "SWC NORDEN": "swc",
        VFR: "vfr",
    },

    NOTAM: "notam",
    eCharts: "echarts",
}

export interface WindowSpec {
    title: string
    component: any
    props?: any
    class?: string
    width: string | number
    height: string | number
}

const wxAirports = [
    "ESSA",
    "ESSB",
    "ESOW",
    "ESGG",
    "ESGP",
    "ESGT",
    "ESGJ",
    "ESMS",
    "ESMK",
    "ESMQ",
    "ESMX",
    "ESOH",
    "ESOE",
    "ESOK",
    "ESSL",
    "ESKN",
    "ESKM",
    "ESNL",
    "ESND",
    "ESNX",
    "ESNK",
    "ESNV",
    "ESNG",
    "ESUP",
]

const availableWindows: { [key: string]: WindowSpec } = {
    notam: {
        title: "NOTAM",
        component: Notam,
        width: 640,
        height: 640,
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
    about: {
        title: "About",
        component: About,
        width: 600,
        height: 240,
    },
}

for (const icao of wxAirports) {
    menuItems.MET.METREPORT[icao] = `metrep${icao}`
    availableWindows[`metrep${icao}`] = {
        title: `METREPORT ${icao}`,
        component: Metreport,
        props: { id: icao },
        width: 360,
        height: 380,
        class: "no-max",
    }
    menuItems.MET.METSENSOR[icao] = `metsen${icao}`
    availableWindows[`metsen${icao}`] = {
        title: `METSENSOR ${icao}`,
        component: Metsensor,
        props: { id: icao },
        width: 360,
        height: 380,
        class: "no-max",
    }
    /*
    menuItems.MET["WX/AWOS"][icao] = `wx${icao}`
    availableWindows[`wx${icao}`] = {
        title: `WX ${icao}`,
        component: Wx,
        props: { id: icao },
        width: 800,
        height: 500,
        class: "no-max",
    }
    */
}

const fullscreen = ref(window.innerHeight == screen.height)

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

function requestFullScreen() {
    const element = document.body as any
    var requestMethod =
        element.requestFullScreen ||
        element.webkitRequestFullScreen ||
        element.mozRequestFullScreen ||
        element.msRequestFullScreen

    if (requestMethod) {
        requestMethod.call(element)
        fullscreen.value = true
    }
}

function exitFullScreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen()
    } else if ((document as any).webkitExitFullscreen) {
        ;(document as any).webkitExitFullscreen()
    } else if ((document as any).mozCancelFullScreen) {
        ;(document as any).mozCancelFullScreen()
    } else if ((document as any).msExitFullscreen) {
        ;(document as any).msExitFullscreen()
    }
    fullscreen.value = false
}

onMounted(() => {
    window.addEventListener("resize", () => {
        fullscreen.value = !!document.fullscreenElement
    })
})


// global exports for fiddling in console

const winbox = useWinBox()
;(window as any).winbox = winbox

const windows = useWindowsStore()
;(window as any).windows = windows

const wx = useWxStore()
;(window as any).wx = wx

const notam = useNotamStore()
;(window as any).notam = notam

;(window as any).moment = moment
;(window as any).axios = axios


</script>
