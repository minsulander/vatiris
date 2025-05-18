<template>
    <div ref="div" style="overflow: hidden" @wheel="handleScrollEvent" @touchmove="handleScrollEvent">
        <div style="position: relative">
            <div ref="overlay" class="focus-overlay" style="position: absolute; top: 0; left: 0; text-align: center; padding-top: 15px; color: white">
                CLICK TO FOCUS<br/>
                BEFORE SCROLLING
            </div>
        </div>
        <iframe
            ref="iframe"
            :src="props.src"
            style="width: 100%; height: 100%; border: none"
        ></iframe>
    </div>
</template>

<style scoped>
/* "steals" click when windows is not focused so that it can be brought to front */
.winbox:not(.focus) .focus-overlay {
    background: rgba(100, 100, 100);
    opacity: 0.01;
    z-index: 1;
    width: 100%;
    height: calc(100vh);
    transition: opacity 0.1s ease-in-out;
}
</style>

<script setup lang="ts">
import useEventBus from "@/eventbus"
import { ref, watch } from "vue"

const props = defineProps<{ src: string }>()
const div = ref()
const overlay = ref()
const iframe = ref()

const bus = useEventBus()
bus.on("refresh", () => {
    const originalSource = iframe.value.src
    iframe.value.src = ""
    setTimeout(() => {
        iframe.value.src = originalSource
    }, 100)
})

watch(iframe, (newValue, oldValue) => {
    if (iframe.value && !oldValue) {
        const winbox = iframe.value.closest(".winbox")
        if (winbox) {
            const title = winbox.querySelector(".wb-title")
            if (title && !title.innerHTML.includes("mdi-open-in-new")) {
                title.innerHTML += ` <a href="${props.src}" target="_blank" style="color: #ddd"><span class="mdi mdi-open-in-new"></span></a> `
            }
        }
    }
})

let overlayTimeout: any = undefined
function handleScrollEvent(e: Event) {
    overlay.value.style.opacity = 0.8
    if (overlayTimeout) clearTimeout(overlayTimeout)
    overlayTimeout = setTimeout(() => {
        overlay.value.style.opacity = 0.01
        overlayTimeout = undefined
    }, 100)
}

</script>
