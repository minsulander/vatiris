<template>
    <v-btn v-if="!auth.pending && !auth.user" class="text-grey" @click="bus.emit('select', 'about')">About</v-btn>
    <PLS v-if="!auth.pending && auth.user"/>
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
</template>

<script setup lang="ts">
import Clock from "@/components/Clock.vue"
import PLS from "@/components/PLS.vue"
import useEventBus from "@/eventbus"
import { useAuthStore } from "@/stores/auth"
import { ref, onMounted } from "vue"

const auth = useAuthStore()
const bus = useEventBus()
const fullscreen = ref(window.innerHeight == screen.height)

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
</script>
