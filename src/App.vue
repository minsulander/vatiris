<template>
    <v-app>
        <v-app-bar color="#2b2d31" height="30" elevation="0">
            <v-btn color="grey">
                System
                <v-menu activator="parent" transition="slide-y-transition">
                    <v-list density="compact">
                        <v-list-item class="text-grey" @click="true">
                            <v-list-item-title>PRESET</v-list-item-title>
                            <v-menu activator="parent" location="end">
                                <v-list density="compact">
                                    <v-list-item
                                        v-for="id in Object.keys(preset.presets)"
                                        :key="id"
                                        @click="preset.load(id)"
                                    >
                                        <v-list-item-title
                                            :class="id == preset.current ? '' : 'text-grey'"
                                            >{{ id }}</v-list-item-title
                                        >
                                    </v-list-item>
                                    <v-divider v-if="Object.keys(preset.presets).length > 0" />
                                    <v-list-item
                                        v-if="preset.current"
                                        class="text-grey"
                                        @click="saveCurrentPreset"
                                        >UPDATE {{ preset.current }}</v-list-item
                                    >
                                    <v-list-item
                                        v-if="preset.current"
                                        class="text-grey"
                                        @click="deleteCurrentPreset"
                                        >DELETE {{ preset.current }}</v-list-item
                                    >
                                    <v-list-item
                                        class="text-grey"
                                        @click="showSavePresetDialog = true"
                                        >NEW...</v-list-item
                                    >
                                </v-list>
                            </v-menu>
                        </v-list-item>
                        <v-list-item class="text-grey" @click="true">
                            <v-list-item-title>RESET</v-list-item-title>
                            <v-menu activator="parent" location="end">
                                <v-list density="compact">
                                    <v-list-item class="text-grey" @click="resetLayout"
                                        >WINDOW LAYOUT</v-list-item
                                    >
                                    <v-list-item class="text-grey" @click="resetAll"
                                        >ALL SETTINGS</v-list-item
                                    >
                                </v-list>
                            </v-menu>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </v-btn>
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
                        <v-list density="compact">
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
                                    <v-list density="compact">
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
            <v-btn class="text-grey" @click="showAboutDialog = true">About</v-btn>
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
            <clock class="mx-2 text-grey" />
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
            <v-dialog v-model="showSavePresetDialog" max-width="500">
                <v-card>
                    <v-card-title class="font-weight-light text-grey"
                        >Save current layout as preset</v-card-title
                    >
                    <v-card-text>
                        <v-text-field
                            variant="underlined"
                            autofocus
                            v-model="presetName"
                            label="Name"
                            @keyup.enter="savePreset"
                            @input="presetName = presetName.toUpperCase()"
                        ></v-text-field>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn
                            variant="text"
                            color="secondary"
                            @click="showSavePresetDialog = false"
                            >Cancel</v-btn
                        >
                        <v-spacer />
                        <v-btn variant="text" color="primary" @click="savePreset">Save</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
            <v-dialog v-model="showAboutDialog" max-width="730">
                <v-card>
                    <v-card-title class="font-weight-light text-grey"
                        >About VatIRIS</v-card-title
                    >
                    <v-card-text>
                        <About />
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer />
                        <v-btn variant="text" color="primary" @click="showAboutDialog = false">Got it</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
        </v-main>
        <confirmation-dialog v-model="confirmation" />
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
import Clock from "@/components/Clock.vue"
import ConfirmationDialog from "@/components/ConfirmationDialog.vue"

import { useWinBox } from "vue-winbox"
import { useWindowsStore } from "./stores/windows"
import { useWxStore } from "./stores/wx"
import { useNotamStore } from "./stores/notam"
import moment from "moment"
import axios from "axios"
import { onMounted, ref } from "vue"
import { usePresetStore } from "./stores/preset"
import { useVatsimStore } from "./stores/vatsim"

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
        width: 420,
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
const showSavePresetDialog = ref(false)
const showAboutDialog = ref(false)
const presetName = ref("")
const confirmation = ref({})

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

function saveCurrentPreset() {
    preset.save(preset.current)
}

function deleteCurrentPreset() {
    function doIt() {
        preset.remove(preset.current)
    }
    confirmation.value = {
        title: "Delete preset",
        text: `Are you sure you want to delete preset ${preset.current}?`,
        action: "DELETE",
        callback: doIt,
    }
}

function savePreset() {
    if (!presetName.value) return
    preset.save(presetName.value)
    showSavePresetDialog.value = false
}

function resetLayout() {
    localStorage.removeItem("layout")
    localStorage.removeItem("preset")
    location.reload()
}

function resetAll() {
    function doIt() {
        const presets = localStorage.presets
        localStorage.clear()
        if (presets) localStorage.presets = presets
        location.reload()
    }
    confirmation.value = {
        title: "Reset all settings",
        text: "This will remove all settings except presets.<br/>Are you sure?",
        action: "RESET",
        callback: doIt,
    }
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

const preset = usePresetStore()
;(window as any).preset = preset
;(window as any).moment = moment
;(window as any).axios = axios

const vatsim = useVatsimStore()
;(window as any).vatsim = vatsim
</script>
