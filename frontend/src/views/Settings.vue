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
            <v-switch color="white" base-color="grey-darken-1" hide-details label="PLS integration" v-model="settings.enablePLS" @change="handleEnablePLSChange" />

            <div v-if="settings.enablePLS">
                <h2 class="mt-4">PLS Logic</h2>
                <v-btn-toggle v-model="settings.plsLogic" mandatory @change="handleLogicChange">
                    <v-btn value="CID">CID</v-btn>
                    <v-btn value="Position">Position</v-btn>
                </v-btn-toggle>

                <v-container v-if="settings.plsLogic === 'CID'" class="mt-4">
                    <v-checkbox v-model="settings.useVatsimConnect" label="Use VATSIM Connect" @change="handleVatsimConnectChange"></v-checkbox>
                    <v-text-field v-if="!settings.useVatsimConnect" label="CID 1" v-model="settings.cid1" outlined dense @input="handleCIDChange"></v-text-field>
                    <v-text-field v-if="!settings.useVatsimConnect" label="CID 2" v-model="settings.cid2" outlined dense @input="handleCIDChange"></v-text-field>
                </v-container>

                <v-container v-if="settings.plsLogic === 'Position'" class="mt-4">
                    <v-text-field label="Position 1" v-model="settings.position1" outlined dense @input="handlePositionChange"></v-text-field>
                    <v-text-field label="Position 2" v-model="settings.position2" outlined dense @input="handlePositionChange"></v-text-field>
                </v-container>

                <v-btn color="primary" class="mt-4" @click="applyChanges" :disabled="!hasChanges">
                    Apply PLS Logic
                </v-btn>
                <v-chip v-if="hasChanges" color="warning" class="ml-2">Unsaved changes</v-chip>
            </div>
        </v-container>
    </v-main>
</template>

<script setup lang="ts">
import { useSettingsStore } from "@/stores/settings"
import { watch, ref } from 'vue'
import useEventBus from "@/eventbus"
import { useAuthStore } from "@/stores/auth"

const settings = useSettingsStore()
const auth = useAuthStore()
const bus = useEventBus()

const hasChanges = ref(false)

const emitLogicChanged = () => {
    let type = settings.plsLogic.toUpperCase()
    let value: string[] = []
    
    if (type === 'CID') {
        if (settings.useVatsimConnect && auth.user) {
            value = [auth.user.cid.toString()]
        } else {
            value = [settings.cid1, settings.cid2].filter(Boolean)
        }
    } else if (type === 'POSITION') {
        value = [settings.position1, settings.position2].filter(Boolean)
    }

    bus.emit('logicChanged', { type, value })
}

const handleEnablePLSChange = (newValue: boolean) => {
    if (!newValue) {
        bus.emit('logicChanged', { type: 'CID', value: [] })
    } else {
        hasChanges.value = true
    }
}

const handleLogicChange = () => {
    if (settings.enablePLS) {
        hasChanges.value = true
        // Clear values when switching logic
        if (settings.plsLogic === 'CID') {
            settings.position1 = ''
            settings.position2 = ''
        } else if (settings.plsLogic === 'Position') {
            settings.cid1 = ''
            settings.cid2 = ''
            settings.useVatsimConnect = false
        }
    }
}

const handleVatsimConnectChange = () => {
    if (settings.enablePLS && settings.plsLogic === 'CID') {
        hasChanges.value = true
    }
}

const handleCIDChange = () => {
    if (settings.enablePLS && settings.plsLogic === 'CID') {
        hasChanges.value = true
    }
}

const handlePositionChange = () => {
    if (settings.enablePLS && settings.plsLogic === 'Position') {
        hasChanges.value = true
    }
}

const applyChanges = () => {
    if (settings.enablePLS && hasChanges.value) {
        emitLogicChanged()
        hasChanges.value = false
    }
}

watch(() => settings.enablePLS, handleEnablePLSChange)

watch(() => settings.plsLogic, handleLogicChange)

watch(() => settings.useVatsimConnect, handleVatsimConnectChange)

watch([() => settings.cid1, () => settings.cid2], handleCIDChange)

watch([() => settings.position1, () => settings.position2], handlePositionChange)
</script>
