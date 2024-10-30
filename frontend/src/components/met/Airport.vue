<template>
    <div class="full-component">
        <Sun :id="props.id" />
        <hr class="component-divider">
        <Metreport :id="props.id" />
        <hr v-if="tafAvailable" class="component-divider">
        <Taf v-if="tafAvailable" :id="props.id" />
        <hr class="component-divider">
        <Metsensor :id="props.id" />
    </div>
</template>

<script setup lang="ts">
import Sun from "@/components/met/Sun.vue"
import Metreport from "@/components/met/Metreport.vue"
import Taf from "@/components/met/Taf.vue"
import Metsensor from "@/components/met/MetsensorWX.vue"
import { tafAirports } from "@/metcommon"
import { computed } from "vue"

const props = defineProps<{ id: string }>()

const tafAvailable = computed(() => tafAirports.includes(props.id))

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