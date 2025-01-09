<template>
    <pdf v-if="auth.user" ref="iframe" :id="'wiki' + id" :src="src" :external-link="props.src" style="width: 100%; height: 100%; border: none"></pdf>
    <div v-else-if="!auth.pending" class="pa-2">Please login to view WIKI content</div>
</template>

<script setup lang="ts">
import { backendBaseUrl, useAuthStore } from "@/stores/auth";
import { computed, ref } from "vue"
import Pdf from "@/components/Pdf.vue"

const props = defineProps<{ id: number, src?: string }>()
const auth = useAuthStore()
const src = computed(() => `${backendBaseUrl}/wiki/attachment/${props.id}?token=${auth.token.access_token}`) // #toolbar=0&page=7
</script>
