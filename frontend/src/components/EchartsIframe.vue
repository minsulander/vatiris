<template>
    <iframe
        ref="iframe"
        src="https://daim.lfv.se/echarts/?x=1764046&y=8000000&z=6r=0&l=001010000100010001001001#"
        style="margin-top: -50px; height: calc(100% + 50px)"
    ></iframe>
</template>

<script setup lang="ts">
import { ref } from "vue"
import useEventBus from "@/eventbus"
const iframe = ref()

// TODO make x, y, z props, and make the URL dynamic

const bus = useEventBus()
bus.on("refresh", () => {
    const originalSource = iframe.value.src
    iframe.value.src = ""
    setTimeout(() => { iframe.value.src = originalSource }, 100)
})
</script>
