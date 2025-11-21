<template>
    <v-app-bar color="#2b2d31" height="30" elevation="0">
        <v-btn variant="text" color="grey" to="/"
            ><v-icon>mdi-chevron-left</v-icon> RETURN TO APP</v-btn
        >
    </v-app-bar>
    <v-main>
        <v-container>
            <h1>Options</h1>
            <v-switch
                color="white"
                base-color="grey-darken-1"
                hide-details
                label="Window snapping"
                v-model="settings.windowSnapping"
            />
            <v-switch
                color="white"
                base-color="grey-darken-1"
                hide-details
                label="METREPORT flash when changed"
                v-model="settings.metreportFlash"
            />
            <v-switch
                color="white"
                base-color="grey-darken-1"
                hide-details
                label="METSENSOR flash changed values"
                v-model="settings.metsensorFlash"
            />
            <v-switch
                color="white"
                base-color="grey-darken-1"
                hide-details
                label="Use custom PDF browser"
                v-model="settings.customPdfBrowser"
            />
            <p class="text-caption text-grey ml-13" style="margin-top: -15px">
                Pros: The custom PDF browser works on mobile devices, zooms differently, and allows clicking to focus window.<br/>
                Cons: Links are not supported, can't zoom with mouse wheel, can't select text.
            </p>

            <h2 class="mt-6">Flight List</h2>

            <v-switch
                color="white"
                base-color="grey-darken-1"
                hide-details
                label="T1 display"
                v-model="settings.showT1"
                class="mt-2"
            />
            <p class="text-caption text-grey ml-13" style="margin-top: -15px">
                Display T1 code next to aircraft type for flights with PBN/T1 capability at RNP AR airports (ESGG, ESMS, ESNZ, ESSA).
            </p>

            <v-switch
                color="white"
                base-color="grey-darken-1"
                hide-details
                label="Slow/Prop display"
                v-model="settings.showSlow"
                class="mt-2"
            />
            <p class="text-caption text-grey ml-13" style="margin-top: -15px">
                Display turtle icon for slow IFR aircraft (as per LPM) from ESSA.<br>
                Display fan icon for propeller-driven aircraft from ESGG.
            </p>

            <h2 class="mt-6">Integrations</h2>

            <v-row class="mt-2">
                <v-col cols="12" sm="4">
                    <v-switch
                        color="white"
                        base-color="grey-darken-1"
                        hide-details
                        label="PLS (PositionsLedningsSystem)"
                        v-model="settings.enablePLS"
                    />
                </v-col>
                <v-col cols="12" sm="4" v-if="settings.enablePLS">
                    <div class="text-caption text-grey-lighten-2">PLS Logic</div>
                    <v-btn-toggle v-model="settings.plsLogic" mandatory>
                        <v-btn value="simple">Simple</v-btn>
                        <v-btn value="CID">CID</v-btn>
                        <v-btn value="Position">Position</v-btn>
                    </v-btn-toggle>
                </v-col>
                <v-col cols="12" sm="4" v-if="settings.enablePLS">
                    <div v-if="settings.plsLogic === 'CID'">
                        <v-checkbox
                            class="pt-4"
                            v-model="settings.useVatsimConnect"
                            label="Use VATSIM Connect"
                        ></v-checkbox>
                        <v-text-field
                            v-if="!settings.useVatsimConnect"
                            label="CID 1"
                            v-model="cid1"
                            outlined
                            dense
                            @input="handleCIDChange"
                            :rules="[cidRules]"
                        ></v-text-field>
                        <v-text-field
                            v-if="!settings.useVatsimConnect"
                            label="CID 2"
                            v-model="cid2"
                            outlined
                            dense
                            @input="handleCIDChange"
                            :rules="[cidRules]"
                        ></v-text-field>
                    </div>
                    <div v-if="settings.plsLogic === 'Position'">
                        <v-text-field
                            label="Position 1"
                            v-model="settings.position1"
                            outlined
                            dense
                        ></v-text-field>
                        <v-text-field
                            label="Position 2"
                            v-model="settings.position2"
                            outlined
                            dense
                        ></v-text-field>
                    </div>
                </v-col>
            </v-row>

            <v-switch
                color="white"
                base-color="grey-darken-1"
                hide-details
                label="FSP (Flight Strip Printer)"
                v-model="settings.fspEnabled"
                class="mt-2"
            />
            <v-text-field
                v-if="settings.fspEnabled"
                label="FSP Server URL"
                v-model="settings.fspUrl"
                outlined
                dense
                placeholder="http://localhost:3000"
                hint="URL to your Flight Strip Printer server"
                persistent-hint
                class="mt-4"
            />
            <p v-if="settings.fspEnabled" class="text-caption text-grey" style="margin-top: 5px">
                Configure the URL to your FSP server to enable printing flight strips directly from the ARR/DEP module.
                Example: http://localhost:3000 or http://192.168.1.100:3000
            </p>
        </v-container>
    </v-main>
</template>

<script setup lang="ts">
import { useSettingsStore } from "@/stores/settings"
import { watch, ref } from "vue"

const settings = useSettingsStore()

const cid1 = ref(settings.cid1)
const cid2 = ref(settings.cid2)

const cidRules = (value: string) => {
    if (!value) return true // Allow empty field
    const regex = /^\d{5,8}$/
    return regex.test(value) || "CID must be 5-8 digits"
}

const handleCIDChange = () => {
    // Validate CID format
    const isValidCID1 = !cid1.value || cidRules(cid1.value) === true
    if (isValidCID1) settings.cid1 = cid1.value
    const isValidCID2 = !cid2.value || cidRules(cid2.value) === true
    if (isValidCID2) settings.cid2 = cid2.value
}

watch(
    () => [settings.plsLogic, settings.useVatsimConnect, settings.cid1, settings.cid2],
    () => {
        cid1.value = settings.cid1
        cid2.value = settings.cid2
    },
)
</script>
