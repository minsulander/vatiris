<template>
    <div style="height: 100%; display: flex; justify-content: center; align-items: center">
        <v-progress-circular v-if="auth.pending" indeterminate color="grey" size="60" />
        <div v-else class="text-grey text-center">
            <h1 class="font-weight-thin text-h4">Welcome to VatIRIS</h1>
            <p class="font-weight-light text-grey-darken-1 mt-2">
                Add a window from the top menu above
            </p>
            <p v-if="auth.user" class="font-weight-light text-grey-darken-1 mt-2">
                {{ auth.user.personal.name_full }}, {{ auth.user.cid }},
                {{ auth.user.vatsim.rating.short }}
                <span
                    v-if="auth.user.vatsim.subdivision && auth.user.vatsim.subdivision.name"
                    class="font-weight-light text-grey-darken-1 mt-2"
                >
                    from {{ auth.user.vatsim.subdivision.name }}</span
                >
                <span
                    v-else-if="auth.user.vatsim.division && auth.user.vatsim.division.name"
                    class="font-weight-light text-grey-darken-1 mt-2"
                >
                    from {{ auth.user.vatsim.division.name }}</span
                >
            </p>
            <p v-else class="font-weight-light text-grey-darken-1 mt-2">
                To make the most of VatIRIS, please<br />
                <v-btn @click="auth.login" variant="text" color="warning">Login with VATSIM</v-btn>
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "@/stores/auth"
const auth = useAuthStore()
</script>
