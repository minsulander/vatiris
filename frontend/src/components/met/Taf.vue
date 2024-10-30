<template>
    <pre class="pa-1" style="white-space: pre-wrap; font-size: 14px; line-height: 16px">{{
        tafStore.taf[id]
    }}</pre>
</template>

<script setup lang="ts">
import { useTafStore } from "@/stores/taf"
import { onMounted, onUnmounted } from "vue"

const props = defineProps<{ id: string }>()

const tafStore = useTafStore()

let subscription = ""
onMounted(() => {
    subscription = tafStore.subscribe(props.id)
})

onUnmounted(() => {
    if (subscription) tafStore.unsubscribe(subscription)
})
</script>
