<template>
    <v-btn type="icon" icon="mdi-sync" class="text-grey" size="small" @click="refresh" />
    <v-btn :color="auth.user || auth.pending ? 'grey' : 'warning'">
        System
        <v-menu activator="parent" transition="slide-y-transition">
            <v-list density="compact">
                <v-list-item to="/settings">
                    <v-list-item-title class="text-grey">SETTINGS</v-list-item-title>
                </v-list-item>
                <v-list-item
                    class="text-grey"
                    @click="true"
                    v-if="auth.user || Object.keys(preset.presets || {}).length > 0"
                >
                    <v-list-item-title>
                        PRESET
                        <v-icon
                            color="grey-darken-2"
                            class="ml-2 float-right"
                            style="margin-top: 2px; margin-right: -3px"
                            size="small"
                            >mdi-chevron-right</v-icon
                        >
                    </v-list-item-title>
                    <v-menu activator="parent" location="end">
                        <v-list density="compact">
                            <v-list-item
                                v-for="id in Object.keys(preset.presets)"
                                :key="id"
                                @click="preset.load(id)"
                            >
                                <v-list-item-title
                                    :class="id == preset.current ? '' : 'text-grey'"
                                    >{{ id }}</v-list-item-title
                                >
                            </v-list-item>
                            <template v-if="auth.user">
                                <v-divider v-if="Object.keys(preset.presets).length > 0" />
                                <v-list-item
                                    v-if="preset.current"
                                    class="text-grey"
                                    @click="saveCurrentPreset"
                                    >UPDATE {{ preset.current }}</v-list-item
                                >
                                <v-list-item
                                    v-if="preset.current"
                                    class="text-grey"
                                    @click="deleteCurrentPreset"
                                    >DELETE {{ preset.current }}</v-list-item
                                >
                                <v-list-item
                                    v-if="preset.current"
                                    class="text-grey"
                                    @click="showRenamePresetDialog = true"
                                    >RENAME...</v-list-item
                                >
                                <v-list-item class="text-grey" @click="showSavePresetDialog = true"
                                    >NEW...</v-list-item
                                >
                            </template>
                        </v-list>
                    </v-menu>
                </v-list-item>
                <v-list-item class="text-grey" @click="true"
                    >DEFAULT<v-icon
                        color="grey-darken-2"
                        class="ml-2 float-right"
                        style="margin-top: 2px; margin-right: -3px"
                        size="small"
                        >mdi-chevron-right</v-icon
                    >
                    <v-menu activator="parent" location="end">
                        <v-list density="compact">
                            <v-list-item
                                v-for="name in Object.keys(preset.defaults || {})"
                                :key="name"
                                class="text-grey"
                                @click="preset.loadDefault(name)"
                                >{{ name }}</v-list-item
                            >
                        </v-list>
                    </v-menu>
                </v-list-item>
                <v-list-item class="text-grey" @click="true">
                    <v-list-item-title>
                        RESET
                        <v-icon
                            color="grey-darken-2"
                            class="ml-2 float-right"
                            style="margin-top: 2px; margin-right: -3px"
                            size="small"
                            >mdi-chevron-right</v-icon
                        >
                    </v-list-item-title>
                    <v-menu activator="parent" location="end">
                        <v-list density="compact">
                            <v-list-item class="text-grey" @click="resetLayout"
                                >WINDOW LAYOUT</v-list-item
                            >
                            <v-list-item class="text-grey" @click="resetLocal"
                                >LOCAL SETTINGS</v-list-item
                            >
                            <v-list-item class="text-grey" @click="resetAll" v-if="auth.user"
                                >ALL SETTINGS</v-list-item
                            >
                        </v-list>
                    </v-menu>
                </v-list-item>
                <v-list-item
                    v-if="!auth.pending && !auth.user"
                    class="text-warning"
                    @click="auth.login"
                    >LOGIN</v-list-item
                >
                <v-list-item
                    v-if="!auth.pending && auth.user"
                    class="text-grey"
                    @click="auth.logout"
                    >LOGOUT</v-list-item
                >
            </v-list>
        </v-menu>
    </v-btn>

    <v-dialog v-model="showSavePresetDialog" max-width="500">
        <v-card>
            <v-card-title class="font-weight-light text-grey"
                >Save current layout as preset</v-card-title
            >
            <v-card-text>
                <v-text-field
                    variant="underlined"
                    autofocus
                    v-model="presetName"
                    label="Name"
                    @keyup.enter="savePreset"
                    @input="presetName = presetName.toUpperCase()"
                ></v-text-field>
            </v-card-text>
            <v-card-actions>
                <v-btn variant="text" color="secondary" @click="showSavePresetDialog = false"
                    >Cancel</v-btn
                >
                <v-spacer />
                <v-btn variant="text" color="primary" @click="savePreset">Save</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    <v-dialog v-model="showRenamePresetDialog" max-width="500">
        <v-card>
            <v-card-title class="font-weight-light text-grey"
                >Rename preset {{ preset.current }}</v-card-title
            >
            <v-card-text>
                <v-text-field
                    variant="underlined"
                    autofocus
                    v-model="presetName"
                    label="Name"
                    @keyup.enter="renamePreset"
                    @input="presetName = presetName.toUpperCase()"
                ></v-text-field>
            </v-card-text>
            <v-card-actions>
                <v-btn variant="text" color="secondary" @click="showRenamePresetDialog = false"
                    >Cancel</v-btn
                >
                <v-spacer />
                <v-btn variant="text" color="primary" @click="renamePreset">Rename</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    <confirmation-dialog v-model="confirmation" />
</template>

<script setup lang="ts">
import ConfirmationDialog from "@/components/ConfirmationDialog.vue"

import { reactive, ref } from "vue"
import { useWindowsStore } from "@/stores/windows"
import { usePresetStore } from "@/stores/preset"
import { useAuthStore } from "@/stores/auth"
import useEventBus from "@/eventbus"

const windows = useWindowsStore()
const preset = usePresetStore()
const auth = useAuthStore()
const bus = useEventBus()

const showSavePresetDialog = ref(false)
const showRenamePresetDialog = ref(false)
const presetName = ref("")
const confirmation = ref({})

function refresh() {
    bus.emit("refresh")
}

function saveCurrentPreset() {
    preset.save(preset.current)
}

function renamePreset() {
    if (!presetName.value) return
    preset.rename(preset.current, presetName.value)
    showRenamePresetDialog.value = false
}

function deleteCurrentPreset() {
    function doIt() {
        preset.remove(preset.current)
    }
    confirmation.value = {
        title: "Delete preset",
        text: `Are you sure you want to delete preset ${preset.current}?`,
        action: "DELETE",
        callback: doIt,
    }
}

function savePreset() {
    if (!presetName.value) return
    preset.save(presetName.value)
    showSavePresetDialog.value = false
}

function resetLayout() {
    localStorage.removeItem("layout")
    localStorage.removeItem("preset")
    for (const id in windows.layout) {
        windows.layout[id].enabled = false
        delete windows.layout[id]
    }
    preset.current = ""
}

function resetLocal() {
    function doIt() {
        const token = localStorage.token
        const tokenTimestamp = localStorage.tokenTimestamp
        localStorage.clear()
        if (token && tokenTimestamp) {
            localStorage.token = token
            localStorage.tokenTimestamp = tokenTimestamp
        }
        location.reload()
    }
    confirmation.value = {
        title: "Reset local settings",
        text: "This will remove all local settings.<br/>Are you sure?",
        action: "RESET",
        callback: doIt,
    }
}

async function resetAll() {
    async function doIt() {
        const token = localStorage.token
        const tokenTimestamp = localStorage.tokenTimestamp
        localStorage.clear()
        await auth.deleteAllUserData()
        if (token && tokenTimestamp) {
            localStorage.token = token
            localStorage.tokenTimestamp = tokenTimestamp
        }
        location.reload()
    }
    confirmation.value = {
        title: "Reset all settings",
        text: "This will remove all settings, including those stored on the server. Are you 100% sure?",
        action: "RESET",
        callback: doIt,
    }
}
</script>
