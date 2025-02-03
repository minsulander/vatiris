<template>
    <div class="d-flex" style="max-height: 100%">
        <div
            class="flex-1-0"
            style="min-height: 0; max-height: 100%; max-width: 50%; overflow: auto"
        >
            <div
                class="text-center"
                style="position: sticky; top: 0; background: white; border-bottom: 1px solid #ccc"
            >
                Arrivals
            </div>
            <arrival-list style="border-right: 1px solid #ccc" />
        </div>
        <div class="flex-1-0" style="min-height: 0; max-height: 100%; overflow: auto">
            <div
                class="text-center"
                style="position: sticky; top: 0; background: white; border-bottom: 1px solid #ccc"
            >
                Departures
            </div>
            <departure-list style="border-left: 1px solid #ccc" />
        </div>
    </div>
</template>

<script setup lang="ts">
import ArrivalList from "./ArrivalList.vue"
import DepartureList from "./DepartureList.vue"
</script>
