<!-- frontend/src/components/Full.vue -->
<template>
    <div class="full-component">
        <Sun :id="props.id" />
        <hr class="component-divider">
        <Metreport :id="props.id" />
        <hr class="component-divider">
        <Metsensor :id="props.id" />
    </div>
</template>

<script setup lang="ts">
import Sun from "@/components/Sun.vue"
import Metreport from "@/components/Metreport.vue"
import Metsensor from "@/components/Metsensor.vue"

const props = defineProps<{ id: string }>()
</script>

<style scoped>
.full-component {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.component-divider {
    width: 100%;
    border: none;
    border-top: 2px solid #808080;
}
</style>