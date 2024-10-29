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
import Sun from "@/components/met/Sun.vue"
import Metreport from "@/components/met/Metreport.vue"
import Metsensor from "@/components/met/MetsensorWX.vue"

const props = defineProps<{ id: string }>()
</script>

<style scoped>
.component-divider {
    width: 100%;
    border: none;
    border-top: 2px solid #808080;
    margin-top: 5px;
    margin-bottom: 5px;
}
</style>