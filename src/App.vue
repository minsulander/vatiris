<template>
    <v-app>
        <v-app-bar color="#2b2d31" height="30">
            <template v-for="(options, title) in windowOptions" :key="title">
                <v-btn v-if="typeof (options) == 'string'" type="text" @click="enable(options)">
                    {{ title }}
                </v-btn>
                <v-btn v-else type="text">
                    {{ title }}
                    <v-menu activator="parent" transition="slide-y-transition">
                        <v-list>
                            <v-list-item
                                v-for="(id, label) in options"
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
import { useWindowsStore } from "./stores/windows"
import { onMounted } from "vue"

const windowOptions = {
    WX: {
        ESSA: "wxESSA",
        ESGG: "wxESGG"
    },
    NOTAM: "notam"
}

export interface WindowSpec {
    title: string,
    component: any,
    props?: any,
    width: string | number,
    height: string | number
}

const availableWindows: {[key: string]: WindowSpec} = {
    wxESSA: {
        title: "WX ESSA",
        component: Wx,
        props: { id: "ESSA" },
        width: 800,
        height: 400
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
        width: 800,
        height: 800
    }
}

const windows = useWindowsStore()

onMounted(() => {})

const winbox = useWinBox()
;(window as any).winbox = winbox

function enable(id: string) {
    if (!(id in availableWindows)) console.error(`Unknown window ${id}`)
    if (id in windows.layout) {
        windows.layout[id].enabled = true
    } else {
        windows.layout[id] = { enabled: true }
    }
}

;(window as any).windows = windows

</script>
