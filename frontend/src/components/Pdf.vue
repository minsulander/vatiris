<template>
    <Iframe :src="src + '#toolbar=0'" />
</template>

<script setup lang="ts">
import Iframe from "./Iframe.vue"
const props = defineProps<{ src: string }>()
</script>
