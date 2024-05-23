<template>
    <iframe :src="props.src" style="width: 100%; height: 100%; border: none"></iframe>
</template>

<script setup lang="ts">
    const props = defineProps<{ src: string }>()
</script>
