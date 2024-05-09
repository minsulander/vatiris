<template>
    <v-app>
        <v-app-bar color="#2b2d31" height="30">
            <template v-for="(options, title) in windowOptions" :key="title">
                <v-btn type="text">
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
                    :id="id"
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
import { useWindowsStore } from "./stores/windows"
import { onMounted } from "vue"

const windowOptions = {
    WX: {
        ESSA: "wxESSA",
        ESGG: "wxESGG"
    }
}

const availableWindows = {
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
    }
}

const windows = useWindowsStore()

onMounted(() => {})

const winbox = useWinBox()
;(window as any).winbox = winbox

function enable(id: string) {
    if (id in windows.layout) {
        windows.layout[id].enabled = true
    } else {
        windows.layout[id] = { enabled: true }
    }
}

;(window as any).windows = windows

</script>
