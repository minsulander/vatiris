<template>
    <v-app>
        <v-app-bar color="#2b2d31" height="30">
            <template v-for="(options, title) in windowOptions" :key="title">
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
        </v-main>
    </v-app>
</template>

<script setup lang="ts">
import { useWinBox } from "vue-winbox"
import Window from "@/components/Window.vue"
import Wx from "@/components/Wx.vue"
import Notam from "@/components/Notam.vue"
import LfvEcharts from "@/components/LfvEcharts.vue"
import Smhi from "@/components/Smhi.vue"
import { useWindowsStore } from "./stores/windows"
import { useWxStore } from "./stores/wx"
import { useNotamStore } from "./stores/notam"
import moment from "moment"

const windowOptions = {
    WX: {
        ESSA: "wxESSA",
        ESSB: "wxESSB",
        ESOW: "wxESOW",
        ESGG: "wxESGG",
        ESGP: "wxESGP",
        ESGT: "wxESGT",
        ESNL: "wxESNL",
        ESKM: "wxESKM",
        ESUP: "wxESUP",
        ESMX: "wxESMX",
        ESND: "wxESND",
        ESSL: "wxESSL",
        ESMS: "wxESMS",
        ESOH: "wxESOH",
        ESNX: "wxESNX",
        ESNK: "wxESNK",
        ESMQ: "wxESMQ",
        ESNV: "wxESNV",
        ESMK: "wxESMK",
        ESOE: "wxESOE",
        ESOK: "wxESOK",
        ESNG: "wxESNG",
        ESKN: "wxESKN",
        ESGJ: "wxESGJ",
    },
    NOTAM: "notam",
    SMHI: "smhi",
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

const availableWindows: { [key: string]: WindowSpec } = {
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
    wxESSA: {
        title: "WX ESSA",
        component: Wx,
        props: { id: "ESSA" },
        width: 800,
        height: 400
    },
    wxESSB: {
        title: "WX ESSB",
        component: Wx,
        props: { id: "ESSB" },
        width: 800,
        height: 500
    },
    wxESNL: {
        title: "WX ESNL",
        component: Wx,
        props: { id: "ESNL" },
        width: 800,
        height: 500,
    },
    wxESKM: {
        title: "WX ESKM",
        component: Wx,
        props: { id: "ESKM" },
        width: 800,
        height: 500,
    },
    wxESUP: {
        title: "WX ESUP",
        component: Wx,
        props: { id: "ESUP" },
        width: 800,
        height: 500,
    },
    wxESMX: {
        title: "WX ESMX",
        component: Wx,
        props: { id: "ESMX" },
        width: 800,
        height: 500,
    },
    wxESND: {
        title: "WX ESND",
        component: Wx,
        props: { id: "ESND" },
        width: 800,
        height: 500,
    },
    wxESGP: {
        title: "WX ESGP",
        component: Wx,
        props: { id: "ESGP" },
        width: 800,
        height: 500,
    },
    wxESGT: {
        title: "WX ESGT",
        component: Wx,
        props: { id: "ESGT" },
        width: 800,
        height: 500,
    },
    wxESSL: {
        title: "WX ESSL",
        component: Wx,
        props: { id: "ESSL" },
        width: 800,
        height: 500,
    },
    wxESMS: {
        title: "WX ESMS",
        component: Wx,
        props: { id: "ESMS" },
        width: 800,
        height: 500,
    },
    wxESOW: {
        title: "WX ESOW",
        component: Wx,
        props: { id: "ESOW" },
        width: 800,
        height: 500,
    },
    wxESOH: {
        title: "WX ESOH",
        component: Wx,
        props: { id: "ESOH" },
        width: 800,
        height: 500,
    },
    wxESNX: {
        title: "WX ESNX",
        component: Wx,
        props: { id: "ESNX" },
        width: 800,
        height: 500,
    },
    wxESNK: {
        title: "WX ESNK",
        component: Wx,
        props: { id: "ESNK" },
        width: 800,
        height: 500,
    },
    wxESMQ: {
        title: "WX ESMQ",
        component: Wx,
        props: { id: "ESMQ" },
        width: 800,
        height: 500,
    },
    wxESNV: {
        title: "WX ESNV",
        component: Wx,
        props: { id: "ESNV" },
        width: 800,
        height: 500,
    },
    wxESMK: {
        title: "WX ESMK",
        component: Wx,
        props: { id: "ESMK" },
        width: 800,
        height: 500,
    },
    wxESOE: {
        title: "WX ESOE",
        component: Wx,
        props: { id: "ESOE" },
        width: 800,
        height: 500,
    },
    wxESOK: {
        title: "WX ESOK",
        component: Wx,
        props: { id: "ESOK" },
        width: 800,
        height: 500,
    },
    wxESNG: {
        title: "WX ESNG",
        component: Wx,
        props: { id: "ESNG" },
        width: 800,
        height: 500,
    },
    wxESKN: {
        title: "WX ESKN",
        component: Wx,
        props: { id: "ESKN" },
        width: 800,
        height: 500,
    },
    wxESGJ: {
        title: "WX ESGJ",
        component: Wx,
        props: { id: "ESGJ" },
        width: 800,
        height: 500,
    },
    wxESGG: {
        title: "WX ESGG",
        component: Wx,
        props: { id: "ESGG" },
        width: 800,
        height: 500
    },
    notam: {
        title: "NOTAM",
        component: Notam,
        width: 640,
        height: 640
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
