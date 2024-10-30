<template>
    <iframe v-if="auth.user" ref="iframe" :src="src" style="width: 100%; height: 100%; border: none"></iframe>
    <div v-else-if="!auth.pending" class="pa-2">Please login to view WIKI content</div>
</template>

<script setup lang="ts">
import useEventBus from "@/eventbus"
import { backendBaseUrl, useAuthStore } from "@/stores/auth";
import { computed, ref } from "vue"

const props = defineProps<{ id: number }>()
const auth = useAuthStore()
const iframe = ref()
const src = computed(() => `${backendBaseUrl}/wiki/attachment/${props.id}?token=${auth.token.access_token}#toolbar=0`) // &page=7

const bus = useEventBus()
bus.on("refresh", () => {
    iframe.value.src = ""
    setTimeout(() => { iframe.value.src = src.value }, 100)
})
</script>
