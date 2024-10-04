<template>
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
    <PLSTimer/>
    <v-dialog v-model="showAboutDialog" max-width="730">
        <v-card>
            <v-card-title class="font-weight-light text-grey pl-6 pt-3">
                <img src="/vatiris-icon2.png" style="max-width: 40px; float: right" />
                About VatIRIS
            </v-card-title>
            <v-card-text>
                <About />
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" color="primary" @click="showAboutDialog = false"
                    >Got it</v-btn
                >
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import Clock from "@/components/Clock.vue"
import About from "@/components/About.vue"
import PLSTimer from "@/components/PLSTimer.vue"
import { ref, onMounted } from "vue"

const showAboutDialog = ref(false)
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
