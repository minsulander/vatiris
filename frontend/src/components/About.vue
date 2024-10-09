<template>
    <div class="text-grey-lighten-1 text-body-2">
        <p class="mb-3">
            VatIRIS is an interpretation of its real-world counterpart
            <a href="https://www.awos.se/sv-se/products/iris.aspx" target="_blank">IRIS</a> -
            Integrated Real-time Information System, but adapted and extended for use by VATSIM
            controllers in Sweden.
        </p>
        <p>It's currently under heavy development, so please expect bugs.</p>
        <p>
            Welcome to file bug reports or feature requests as
            <a href="https://github.com/minsulander/vatiris/issues" target="_blank">issues</a>
        </p>
        <p class="mt-3" v-if="auth.user">
            Logged in as {{ auth.user.personal.name_full }}, {{ auth.user.cid }},
            {{ auth.user.vatsim.rating.short }}
            <span v-if="auth.user.vatsim.subdivision && auth.user.vatsim.subdivision.name">
                from {{ auth.user.vatsim.subdivision.name }}</span
            >
            <span v-else-if="auth.user.vatsim.division && auth.user.vatsim.division.name">
                from {{ auth.user.vatsim.division.name }}</span
            >
        </p>
        <p class="mt-3">
            <router-link class="text-grey-darken-1" to="privacy">Privacy policy</router-link>
        </p>
        <p class="text-grey-darken-1 mt-3">
            Copyright &copy; 2024 Martin Insulander and contributors
        </p>
        <p class="mt-3">
            <a
                class="text-grey-darken-1"
                href="https://github.com/minsulander/vatiris"
                target="_blank"
                ><v-icon>mdi-github</v-icon> VatIRIS on GitHub</a
            >
        </p>
    </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "@/stores/auth"
const auth = useAuthStore()
</script>
