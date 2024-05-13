<template>
    <pre class="pa-1" style="font-size: 14px; line-height: 16px" v-html="wx.wx[props.id]"></pre>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue"
import { useWxStore } from "@/stores/wx";

const props = defineProps<{ id: string }>()

const wx = useWxStore()

let subscription = ""

onMounted(() => {
    subscription = wx.subscribe(props.id)
})

onUnmounted(() => {
    wx.unsubscribe(subscription)
})
</script>
