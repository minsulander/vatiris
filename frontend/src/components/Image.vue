<template>
    <div ref="div" style="height: 100%">
        <img ref="img" :src="imgsrc" style="width: 100%" :style="'opacity: ' + (loaded ? 1 : 0)" />
    </div>
</template>

<style scoped>
img {
    transition: opacity 0.25s;
}
</style>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue"

const props = defineProps<{ id: string; src: string; refresh?: string }>()

const div = ref()
const img = ref()

const loaded = ref(false)
const loadTime = ref(Date.now().toString())
const imgsrc = computed(() => `${props.src}?${loadTime.value}`)

let refreshInterval: any = undefined

onMounted(() => {
    if (`${props.id}_image_scroll` in localStorage)
        div.value.parentElement.scrollTop = parseInt(localStorage[`${props.id}_image_scroll`])
    img.value.onload = () => {
        loaded.value = true
        if (`${props.id}_image_scroll` in localStorage)
            div.value.parentElement.scrollTop = parseInt(localStorage[`${props.id}_image_scroll`])
    }
    div.value.parentElement.addEventListener("scroll", scroll)
    if (props.refresh && parseInt(props.refresh)) {
        refreshInterval = setInterval(
            () => {
                console.log(`Refresh image ${props.id}`)
                loadTime.value = Date.now().toString()
            },
            parseInt(props.refresh) * 1000,
        )
    }
    // below needed when restoring from minimized
    new ResizeObserver(() => {
        if (`${props.id}_image_scroll` in localStorage && div.value) {
            div.value.parentElement.scrollTop = parseInt(localStorage[`${props.id}_image_scroll`])
        }
    }).observe(div.value)
})

onUnmounted(() => {
    if (refreshInterval) clearInterval(refreshInterval)
})

function scroll(e: Event) {
    const target = e.target as HTMLElement
    if (target && target.parentElement && !target.parentElement.className.endsWith("min"))
        localStorage[`${props.id}_image_scroll`] = target.scrollTop
}
</script>
