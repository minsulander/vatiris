<template>
    <iframe
        v-if="src"
        class="striptv-stream"
        :src="src"
        title="STRIPVIEW stream"
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin"
    />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import axios from "axios"
import { backendBaseUrl } from "@/stores/auth"

const src = ref("")
let cancelled = false

onMounted(async () => {
    try {
        const { data } = await axios.get<{ src?: string }>(`${backendBaseUrl}/striptv/esgg`, {
            headers: { "Cache-Control": "no-cache" },
        })
        if (!cancelled) src.value = (data?.src || "").trim()
    } catch {
        if (!cancelled) src.value = ""
    }
})

onUnmounted(() => {
    cancelled = true
})
</script>

<style scoped>
.striptv-stream {
    display: block;
    width: 100%;
    height: 100%;
    border: none;
    pointer-events: none;
}
</style>
