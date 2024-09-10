<template>
    <div style="height: 100%; display: flex; justify-content: center; align-items: center">
        <v-progress-circular v-if="auth.pending" indeterminate color="grey" size="60" />
        <div v-else class="text-grey text-center">
            <h1 class="font-weight-thin text-h4">Welcome to VatIRIS</h1>
            <div v-if="auth.user" class="font-weight-light text-grey-darken-1 text-h5">
                {{ auth.user.cid }}, {{ auth.user.vatsim.rating.short }} from
                {{ auth.user.vatsim.subdivision.name }}
            </div>

            <p class="font-weight-light text-grey-darken-1">Add a window from the top menu above</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
</script>
