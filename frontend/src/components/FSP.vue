<template>
    <div>
        <v-btn
            icon
            color="grey"
            @click="openPrintDialog"
        >
            <v-icon>{{ statusIcon }}</v-icon>
        </v-btn>

        <v-dialog v-model="showPrintDialog" max-width="500">
            <v-card>
                <v-card-title>FSP - Flight Strip Printer</v-card-title>
                <v-card-text>
                    <v-alert
                        v-if="!settings.fspUrl"
                        type="warning"
                        variant="tonal"
                        class="mb-4"
                    >
                        FSP URL not configured. Please configure in Settings.
                    </v-alert>
                    <v-alert
                        v-else-if="isConnected === false"
                        type="error"
                        variant="tonal"
                        class="mb-4"
                    >
                        Connection to FSP server failed.
                    </v-alert>
                    <v-alert
                        v-else-if="isConnected === true"
                        type="success"
                        variant="tonal"
                        class="mb-4"
                    >
                        Connected to {{ settings.fspUrl }}
                    </v-alert>

                    <v-text-field
                        v-model="manualCallsign"
                        label="Callsign"
                        placeholder="Enter callsign (e.g., SAS123)"
                        hint="Print a strip for a specific aircraft"
                        persistent-hint
                        density="compact"
                        class="mb-4"
                        :disabled="!settings.fspUrl || vatfsp.printing"
                        @keydown.enter="printManualStrip"
                    />

                    <v-divider class="my-4" />

                    <div class="text-caption text-grey mb-2">Quick Actions</div>
                    <v-btn
                        variant="outlined"
                        block
                        :disabled="!settings.fspUrl || vatfsp.printing"
                        @click="printTemplateStrip"
                        prepend-icon="mdi-printer-pos"
                        class="mb-2"
                    >
                        Print Empty Template Strip
                    </v-btn>
                    <v-btn
                        variant="outlined"
                        block
                        color="warning"
                        :disabled="vatfsp.printing || Object.keys(vatfsp.printedFlights).length === 0"
                        @click="clearAllPrinted"
                        prepend-icon="mdi-delete-sweep"
                        class="mb-2"
                    >
                        Clear All Printed Strips ({{ Object.keys(vatfsp.printedFlights).length }})
                    </v-btn>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn
                        color="grey"
                        variant="text"
                        @click="showPrintDialog = false"
                    >
                        Close
                    </v-btn>
                    <v-btn
                        v-if="!settings.fspUrl"
                        color="primary"
                        variant="text"
                        @click="goToSettings"
                    >
                        Open Settings
                    </v-btn>
                    <v-btn
                        v-else-if="isConnected === false"
                        color="primary"
                        variant="text"
                        @click="checkConnection"
                    >
                        Retry Connection
                    </v-btn>
                    <v-btn
                        v-else
                        color="primary"
                        variant="text"
                        :disabled="!manualCallsign || vatfsp.printing"
                        @click="printManualStrip"
                    >
                        Print Strip
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue"
import { useSettingsStore } from "@/stores/settings"
import { useVatfspStore } from "@/stores/vatfsp"
import { useVatsimStore } from "@/stores/vatsim"
import { useFdpStore } from "@/stores/fdp"
import { useEsdataStore } from "@/stores/esdata"
import { useAirportStore } from "@/stores/airport"
import { distanceToAirport, flightplanArrivalTime, flightplanDepartureTime } from "@/flightcalc"
import moment from "moment"
import constants from "@/constants"
import useEventBus from "@/eventbus"

const settings = useSettingsStore()
const vatfsp = useVatfspStore()
const vatsim = useVatsimStore()
const fdp = useFdpStore()
const esdata = useEsdataStore()
const airportStore = useAirportStore()
const bus = useEventBus()
const isConnected = ref<boolean | null>(null)
const isChecking = ref(false)
const showPrintDialog = ref(false)
const manualCallsign = ref("")

const statusIcon = computed(() => {
    if (!settings.fspEnabled) {
        return "mdi-printer-pos-off"
    }
    if (!settings.fspUrl) {
        return "mdi-printer-pos-cog"
    }
    if (isConnected.value === null) {
        return "mdi-printer-pos"
    }
    if (isConnected.value === false) {
        return "mdi-printer-pos-remove"
    }
    return "mdi-printer-pos"
})

function openPrintDialog() {
    // If FSP is disabled, open settings
    if (!settings.fspEnabled) {
        goToSettings()
        return
    }
    
    showPrintDialog.value = true
    manualCallsign.value = ""
    if (settings.fspUrl && isConnected.value === null) {
        checkConnection()
    }
}

function goToSettings() {
    showPrintDialog.value = false
    window.location.href = "/#/settings"
}

async function checkConnection() {
    if (!settings.fspUrl) {
        isConnected.value = null
        return
    }

    if (isChecking.value) return
    isChecking.value = true

    try {
        // Check if the FSP API endpoint is actually available
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        
        // Try to access the /api/printer/status endpoint or similar
        const response = await fetch(`${settings.fspUrl}/api/printer/status`, {
            method: "GET",
            signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        // Check if we got a valid response
        if (response.ok) {
            isConnected.value = true
        } else {
            isConnected.value = false
            console.debug("FSP server responded but with error:", response.status)
        }
    } catch (error: any) {
        isConnected.value = false
        console.debug("FSP connection check failed:", error.message || error)
    } finally {
        isChecking.value = false
    }
}

async function printTemplateStrip() {
    const success = await vatfsp.printFlightStrip(
        {
            callsign: "",
            type: "",
            adep: "",
            ades: "",
            stand: "",
            std: "",
            sta: "",
            eta: "",
            status: "",
        },
        false, // isArrival
        undefined, // squawk
        undefined, // route
        undefined, // rfl
        undefined, // sid
        undefined, // wtc
    )
    
    if (success) {
        showPrintDialog.value = false
    }
}

async function clearAllPrinted() {
    if (confirm(`Are you sure you want to clear all ${Object.keys(vatfsp.printedFlights).length} printed strips? This will affect all connected clients.`)) {
        await vatfsp.clearAllPrintedFlights()
    }
}

async function printManualStrip() {
    if (!manualCallsign.value) return

    const callsign = manualCallsign.value.toUpperCase().trim()

    // Try to find the pilot in VATSIM data
    if (!vatsim.data || !vatsim.data.pilots) {
        console.warn("No VATSIM data available")
        return
    }

    const pilot = vatsim.data.pilots.find((p) => p.callsign === callsign)
    if (!pilot || !pilot.flight_plan) {
        console.warn(`Flight ${callsign} not found in VATSIM data`)
        // Print with just the callsign
        await vatfsp.printFlightStrip(
            {
                callsign,
                type: "",
                adep: "",
                ades: "",
                stand: "",
                std: "",
                sta: "",
                eta: "",
                status: "",
            },
            false,
            undefined, // squawk
            undefined, // route
            undefined, // rfl
            undefined, // sid
            undefined, // wtc
        )
        manualCallsign.value = ""
        showPrintDialog.value = false
        return
    }

    // Determine if this is an arrival or departure
    const isInFlight = pilot.groundspeed >= constants.inflightGroundspeed
    const isArrival = pilot.flight_plan.arrival.startsWith("ES")
    
    let flightData: any = {
        callsign: pilot.callsign,
        type: pilot.flight_plan.aircraft_short || "",
        adep: pilot.flight_plan.departure || "",
        ades: pilot.flight_plan.arrival || "",
        stand: "",
        std: "",
        sta: "",
        eta: "",
        status: "",
        flightRules: pilot.flight_plan.flight_rules,
    }

    // Calculate stand if on ground
    if (pilot.groundspeed < constants.motionGroundspeed) {
        const airport = isArrival ? pilot.flight_plan.arrival : pilot.flight_plan.departure
        flightData.stand = airportStore.getStandNameAtLocation(airport, [
            pilot.longitude,
            pilot.latitude,
        ]) || ""
    }

    // Always set STD (EOBT) - it's the departure time from origin
    flightData.std = flightplanDepartureTime(pilot.flight_plan)?.format("HHmm") || ""

    // Calculate STA/ETA for arrivals
    if (isArrival && isInFlight) {
        flightData.sta = flightplanArrivalTime(pilot.flight_plan)?.format("HHmm") || ""
        
        // Try to get ETA from FDP data first
        if (fdp.fdp?.flights && callsign in fdp.fdp.flights && fdp.fdp.general?.update_timestamp) {
            const fdpFlight = fdp.fdp.flights[callsign]
            const prediction = fdpFlight.prediction
            if (prediction) {
                const lastLeg = prediction.legs[prediction.legs.length - 1]
                flightData.eta = moment(fdp.fdp.general.update_timestamp)
                    .add(lastLeg.time, "seconds")
                    .utc()
                    .format("HHmm")
            }
        } 
        
        // Fall back to distance-based calculation
        if (!flightData.eta && pilot.flight_plan.arrival in airportStore.airports) {
            const airport = airportStore.airports[pilot.flight_plan.arrival]
            const distance = distanceToAirport(pilot, airport)
            if (pilot.groundspeed >= constants.inflightGroundspeed) {
                const seconds = (distance / pilot.groundspeed) * 3600
                flightData.eta = moment().utc().add(seconds, "seconds").format("HHmm")
            }
        }
    }
    
    // Add status from Euroscope data if available
    if (esdata.data && callsign in esdata.data) {
        const esd = esdata.data[callsign]
        if (esd.groundstate) flightData.status = esd.groundstate
        if (!flightData.stand && esd.stand) flightData.stand = esd.stand
    }

    const success = await vatfsp.printFlightStrip(
        flightData,
        isArrival && isInFlight, // isArrival
        pilot.flight_plan.assigned_transponder,
        pilot.flight_plan.route,
        pilot.flight_plan.altitude,
        undefined, // sid - not available
        undefined, // wtc - not available
    )
    
    if (success) {
        manualCallsign.value = ""
        showPrintDialog.value = false
    }
}

let checkInterval: number | undefined
let fdpSubscription: any = undefined
let esdataSubscription: any = undefined

function handleRefresh() {
    // Sync FSP state when refresh is triggered
    vatfsp.syncStateFromBackend(true)
}

onMounted(() => {
    // Initial check
    if (settings.fspUrl) {
        checkConnection()
    }

    // Check connection every 30 seconds
    checkInterval = window.setInterval(() => {
        if (settings.fspUrl) {
            checkConnection()
        }
    }, 30000)

    // Subscribe to FDP and esdata
    fdpSubscription = fdp.subscribe()
    esdataSubscription = esdata.subscribe()
    
    // Listen for refresh events
    bus.on("refresh", handleRefresh)
})

onUnmounted(() => {
    if (checkInterval) {
        clearInterval(checkInterval)
    }
    
    // Unsubscribe from FDP and esdata
    if (fdpSubscription) {
        fdp.unsubscribe(fdpSubscription)
    }
    if (esdataSubscription) {
        esdata.unsubscribe(esdataSubscription)
    }
})

// Watch for FSP URL changes
watch(
    () => settings.fspUrl,
    (newUrl) => {
        if (newUrl) {
            isConnected.value = null
            checkConnection()
        } else {
            isConnected.value = null
        }
    }
)
</script>

