<template>
    <iframe ref="iframe" :src="props.src" style="width: 100%; height: 100%; border: none"></iframe>
</template>

<script setup lang="ts">
import useEventBus from "@/eventbus"
import { ref, defineProps } from "vue"

const props = defineProps<{ src: string }>()
const iframe = ref()

const bus = useEventBus()
bus.on("refresh", () => {
    const originalSource = iframe.value.src
    iframe.value.src = ""
    setTimeout(() => { iframe.value.src = originalSource }, 100)
})
</script>
