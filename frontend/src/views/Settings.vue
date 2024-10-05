<template>
    <v-app-bar color="#2b2d31" height="30" elevation="0">
        <v-btn variant="text" color="grey" to="/"
            ><v-icon>mdi-chevron-left</v-icon> RETURN TO APP</v-btn
        >
    </v-app-bar>
    <v-main>
        <v-container>
            <h1>Options</h1>
            <v-switch color="white" base-color="grey-darken-1" hide-details label="Window snapping" v-model="settings.windowSnapping" />
            <v-switch color="white" base-color="grey-darken-1" hide-details label="METREPORT flash when changed" v-model="settings.metreportFlash" />
            <v-switch color="white" base-color="grey-darken-1" hide-details label="METSENSOR flash changed values" v-model="settings.metsensorFlash" />
        </v-container>
    </v-main>
</template>

<script setup lang="ts">
import { useSettingsStore } from "@/stores/settings"

const settings = useSettingsStore()
</script>
