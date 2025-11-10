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
                        @keydown.enter="handleEnterKey"
                        @input="handleCallsignInput"
                    />

                    <div v-if="vatsimFlightPlanFound && foundPilot" class="mb-4">
                        <v-alert type="success" variant="tonal" density="compact" class="mb-2">
                            Flight plan found for {{ foundPilot.callsign }}
                        </v-alert>
                        <div style="display: flex; gap: 8px;">
                            <v-btn
                                variant="flat"
                                :style="{
                                    backgroundColor: '#fe8',
                                    color: '#000',
                                    flex: 1,
                                    border: selectedStripType === 'arr' ? '3px solid #000' : '3px solid transparent',
                                    fontWeight: selectedStripType === 'arr' ? 'bold' : 'normal'
                                }"
                                :disabled="vatfsp.printing"
                                @click="selectedStripType = 'arr'"
                                prepend-icon="mdi-airplane-landing"
                            >
                                ARR
                            </v-btn>
                            <v-btn
                                variant="flat"
                                :style="{
                                    backgroundColor: '#6ce',
                                    color: '#000',
                                    flex: 1,
                                    border: selectedStripType === 'dep' ? '3px solid #000' : '3px solid transparent',
                                    fontWeight: selectedStripType === 'dep' ? 'bold' : 'normal'
                                }"
                                :disabled="vatfsp.printing"
                                @click="selectedStripType = 'dep'"
                                prepend-icon="mdi-airplane-takeoff"
                            >
                                DEP
                            </v-btn>
                        </div>
                        
                        <!-- SID Selection for ESGG Departures -->
                        <div v-if="selectedStripType === 'dep' && foundPilot?.flight_plan?.departure === 'ESGG' && esggRunwayInUse" class="mt-4">
                            <div class="text-caption text-grey mb-2">SID Selection (ESGG)</div>
                            <v-alert type="info" variant="tonal" density="compact" class="mb-2">
                                Runway in use: <strong>{{ esggRunwayInUse }}</strong>
                            </v-alert>
                            <v-select
                                v-model="selectedSID"
                                :items="availableSIDs"
                                item-title="sidName"
                                item-value="value"
                                label="Select SID"
                                density="compact"
                                variant="outlined"
                                :disabled="vatfsp.printing"
                                clearable
                                hint="Optional: Override automatic SID detection"
                                persistent-hint
                            />
                        </div>
                    </div>

                    <v-alert v-else-if="vatsimFlightPlanFound === false" type="warning" variant="tonal" density="compact" class="mb-4">
                        No flight plan found on VATSIM
                    </v-alert>

                    <!-- Runway in use for ESGG (always shown) -->
                    <div v-if="esggRunwayInUseDisplay" class="mb-4">
                        <v-alert 
                            type="info" 
                            variant="tonal" 
                            density="compact"
                            :class="{ 'text-grey-darken-1': !manualRunwayOverride }"
                        >
                            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;">
                                    <span>
                                        ESGG Runway in use: <strong>{{ esggRunwayInUseDisplay }}</strong>
                                        <span v-if="manualRunwayOverride" class="text-caption ml-2">(Manual)</span>
                                    </span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <v-select
                                        v-model="manualRunwayOverride"
                                        :items="availableRunways"
                                        label="Override"
                                        density="compact"
                                        variant="outlined"
                                        :disabled="vatfsp.printing"
                                        clearable
                                        hide-details
                                        style="min-width: 120px; max-width: 150px;"
                                        @update:model-value="onRunwayOverrideChange"
                                    />
                                    <v-btn
                                        icon
                                        size="x-small"
                                        variant="text"
                                        @click="refreshRunway"
                                        :disabled="vatfsp.printing"
                                    >
                                        <v-icon size="small">mdi-refresh</v-icon>
                                        <v-tooltip activator="parent" location="top">Reload runway from weather</v-tooltip>
                                    </v-btn>
                                </div>
                            </div>
                        </v-alert>
                    </div>

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
                        v-else-if="vatsimFlightPlanFound && selectedStripType"
                        color="primary"
                        variant="text"
                        :disabled="vatfsp.printing"
                        @click="executePrint"
                    >
                        Print {{ selectedStripType === 'arr' ? 'ARR' : 'DEP' }} Strip
                    </v-btn>
                    <v-btn
                        v-else-if="vatsimFlightPlanFound === false && manualCallsign"
                        color="primary"
                        variant="text"
                        :disabled="vatfsp.printing"
                        @click="printManualStrip()"
                    >
                        Print Anyway
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
import { useWxStore } from "@/stores/wx"
import { distanceToAirport, flightplanArrivalTime, flightplanDepartureTime, formatRFL, getEffectiveFlightRules, normalizeFlightRules, getSIDName, getCleanedRoute } from "@/flightcalc"
import { sidManager } from "@/sid"
import { useFspRunway } from "@/composables/useFspRunway"
import moment from "moment"
import constants from "@/constants"
import useEventBus from "@/eventbus"

const settings = useSettingsStore()
const vatfsp = useVatfspStore()
const vatsim = useVatsimStore()
const fdp = useFdpStore()
const esdata = useEsdataStore()
const airportStore = useAirportStore()
const wx = useWxStore()
const bus = useEventBus()
const isConnected = ref<boolean | null>(null)
const isChecking = ref(false)
const showPrintDialog = ref(false)
const manualCallsign = ref("")
const vatsimFlightPlanFound = ref<boolean | null>(null)
const foundPilot = ref<any>(null)
const selectedStripType = ref<'arr' | 'dep' | null>(null)
const selectedSID = ref<string | null>(null)
const { manualRunwayOverride } = useFspRunway()

// Available runways for ESGG
const availableRunways = [
    { title: '03', value: '03' },
    { title: '21', value: '21' }
]

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
    vatsimFlightPlanFound.value = null
    foundPilot.value = null
    selectedStripType.value = null
    selectedSID.value = null
    // Don't reset manualRunwayOverride - keep it persistent across dialog opens
    if (settings.fspUrl && isConnected.value === null) {
        checkConnection()
    }
}

function resetFlightPlanState() {
    vatsimFlightPlanFound.value = null
    foundPilot.value = null
    selectedStripType.value = null
    selectedSID.value = null
}

function refreshRunway() {
    // Clear manual override and force refresh wx data for ESGG
    manualRunwayOverride.value = null
    wx.fetch('ESGG')
}

function onRunwayOverrideChange() {
    // Reset selected SID when runway changes
    selectedSID.value = null
}

// Helper function to parse runway from wx store
function parseRunwayFromWx(icao: string, preferDeparture: boolean = true): string | null {
    const rwyText = wx.rwy(icao)
    if (!rwyText) return null
    
    // Parse runway text - handle formats like "RUNWAY IN USE: <b>03</b>" or "ARR: 03 DEP: 21"
    const rwyEl = document.createElement("div")
    rwyEl.innerHTML = rwyText
    const cleanRwy = rwyEl.innerText.replace("RUNWAY IN USE: ", "").trim()
    
    if (preferDeparture) {
        // Check for DEP: format first (for departures)
        const depMatch = cleanRwy.match(/DEP:\s*(\d{2}[LRC]?)/i)
        if (depMatch && depMatch[1]) {
            return depMatch[1]
        }
        
        // Check for ARR: DEP: format
        const arrDepMatch = cleanRwy.match(/ARR:\s*(\d{2}[LRC]?)\s+DEP:\s*(\d{2}[LRC]?)/i)
        if (arrDepMatch && arrDepMatch[2]) {
            return arrDepMatch[2]
        }
    } else {
        // Check for ARR: format first (for arrivals)
        const arrMatch = cleanRwy.match(/ARR:\s*(\d{2}[LRC]?)/i)
        if (arrMatch && arrMatch[1]) {
            return arrMatch[1]
        }
        
        // Check for ARR: DEP: format
        const arrDepMatch = cleanRwy.match(/ARR:\s*(\d{2}[LRC]?)\s+DEP:\s*(\d{2}[LRC]?)/i)
        if (arrDepMatch && arrDepMatch[1]) {
            return arrDepMatch[1]
        }
    }
    
    // Fallback: if it's just a runway number (single runway)
    if (cleanRwy.match(/^\d{2}[LRC]?$/)) {
        return cleanRwy
    }
    
    return null
}

// Get runway in use for ESGG (always shown in dialog)
const esggRunwayInUseAlways = computed(() => {
    return parseRunwayFromWx('ESGG', true)
})

// Display runway (with manual override if set)
const esggRunwayInUseDisplay = computed(() => {
    return manualRunwayOverride.value || esggRunwayInUseAlways.value
})

// Get runway in use for ESGG departures (for SID selection)
// This is used for SID dropdown filtering - only show when departure is ESGG
const esggRunwayInUse = computed(() => {
    if (!foundPilot.value?.flight_plan?.departure || foundPilot.value.flight_plan.departure !== 'ESGG') {
        return null
    }
    return esggRunwayInUseDisplay.value
})


// Get available SIDs for ESGG runway in use
const availableSIDs = computed(() => {
    if (!esggRunwayInUse.value) {
        return []
    }
    
    // Extract runway number (e.g., "03" from "03")
    const runwayNumber = sidManager.extractRunwayNumber(esggRunwayInUse.value)
    if (!runwayNumber) {
        return []
    }
    
    // Get SIDs for this runway
    const sids = sidManager.getSIDsForRunway('ESGG', runwayNumber)
    
    // Format for v-select
    return sids.map(sid => ({
        sidName: sid.sidName.startsWith('VFR·') ? sid.sidName.substring(4) : sid.sidName,
        fullName: sid.sidName,
        value: sid.sidName.startsWith('VFR·') ? sid.sidName.substring(4) : sid.sidName
    }))
})

function handleCallsignInput(event: any) {
    // Auto-capitalize the callsign
    const input = event.target as HTMLInputElement
    const cursorPosition = input.selectionStart
    const uppercased = manualCallsign.value.toUpperCase()
    
    if (manualCallsign.value !== uppercased) {
        manualCallsign.value = uppercased
        // Restore cursor position after Vue updates the value
        setTimeout(() => {
            if (cursorPosition !== null) {
                input.setSelectionRange(cursorPosition, cursorPosition)
            }
        }, 0)
    }
    
    // Search for flight plan while typing
    checkCallsignAndPrepare()
}

function handleEnterKey() {
    // If flight plan found and strip type selected, execute print
    if (vatsimFlightPlanFound.value === true && selectedStripType.value) {
        executePrint()
    }
    // If no flight plan found, trigger print anyway
    else if (vatsimFlightPlanFound.value === false) {
        printManualStrip()
    }
    // Otherwise do nothing (user needs to select ARR/DEP first)
}

function executePrint() {
    if (!selectedStripType.value) return
    printManualStrip(selectedStripType.value === 'arr')
}

function checkCallsignAndPrepare() {
    if (!manualCallsign.value) {
        resetFlightPlanState()
        return
    }

    const callsign = manualCallsign.value.toUpperCase().trim()
    
    // Need at least 3 characters to search
    if (callsign.length < 3) {
        resetFlightPlanState()
        return
    }

    // Try to find the pilot in VATSIM data
    if (!vatsim.data || !vatsim.data.pilots) {
        vatsimFlightPlanFound.value = false
        foundPilot.value = null
        return
    }

    // Check connected pilots first
    let pilot: any = vatsim.data.pilots.find((p) => p.callsign === callsign)
    
    // If not found in pilots, check prefiles
    if (!pilot && vatsim.data.prefiles) {
        pilot = vatsim.data.prefiles.find((p) => p.callsign === callsign)
    }
    
    if (!pilot || !pilot.flight_plan) {
        vatsimFlightPlanFound.value = false
        foundPilot.value = null
        return
    }

    // Flight plan found!
    vatsimFlightPlanFound.value = true
    foundPilot.value = pilot
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
        }
    } catch (error: any) {
        isConnected.value = false
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

async function printManualStrip(isArrival?: boolean) {
    if (!manualCallsign.value) return

    const callsign = manualCallsign.value.toUpperCase().trim()

    // Try to find the pilot in VATSIM data
    if (!vatsim.data || !vatsim.data.pilots) {
        return
    }

    // Check connected pilots first
    let pilot: any = vatsim.data.pilots.find((p) => p.callsign === callsign)
    
    // If not found in pilots, check prefiles
    if (!pilot && vatsim.data.prefiles) {
        pilot = vatsim.data.prefiles.find((p) => p.callsign === callsign)
    }
    
    // If no flight plan found, show confirmation dialog
    if (!pilot || !pilot.flight_plan) {
        const confirmed = confirm(
            `No flight plan found on VATSIM for ${callsign}.\n\nDo you want to print an empty strip with just the callsign?`
        )
        
        if (!confirmed) {
            return
        }
        
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
        vatsimFlightPlanFound.value = null
        foundPilot.value = null
        selectedStripType.value = null
        selectedSID.value = null
        showPrintDialog.value = false
        return
    }

    // If isArrival not specified, try to determine automatically
    if (isArrival === undefined) {
        // For prefiles, groundspeed will be 0 or undefined, so treat as departure by default
        const isInFlight = pilot.groundspeed ? pilot.groundspeed >= constants.inflightGroundspeed : false
        isArrival = pilot.flight_plan.arrival.startsWith("ES") && isInFlight
    }
    
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
        flightRules: normalizeFlightRules(pilot.flight_plan.flight_rules, pilot.flight_plan.route), // Auto-detect Y/Z from I/V
        tas: pilot.flight_plan.cruise_tas || "",
    }

    // Calculate stand if on ground (only for connected pilots, not prefiles)
    if (pilot.groundspeed !== undefined && pilot.groundspeed < constants.motionGroundspeed && pilot.longitude && pilot.latitude) {
        const airport = isArrival ? pilot.flight_plan.arrival : pilot.flight_plan.departure
        flightData.stand = airportStore.getStandNameAtLocation(airport, [
            pilot.longitude,
            pilot.latitude,
        ]) || ""
    }

    // Always set STD (EOBT) - it's the departure time from origin
    flightData.std = flightplanDepartureTime(pilot.flight_plan)?.format("HHmm") || ""

    // Calculate STA/ETA for arrivals
    if (isArrival) {
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
        
        // Fall back to distance-based calculation (only for connected pilots)
        if (!flightData.eta && pilot.flight_plan.arrival in airportStore.airports && pilot.longitude && pilot.latitude && pilot.groundspeed) {
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

    // Process SID information for departures
    let sidName: string | undefined
    let cleanedRoute = pilot.flight_plan.route
    
    if (!isArrival && pilot.flight_plan.departure) {
        const isESGG = pilot.flight_plan.departure === 'ESGG'
        const metreport = wx.metreport(pilot.flight_plan.departure)
        
        // Get effective flight rules
        const effectiveFlightRules = getEffectiveFlightRules(
            pilot.flight_plan.flight_rules,
            pilot.flight_plan.route
        )
        
        // For ESGG: use manual override if set, otherwise let metreport extract runway from ATIS
        let runwayForSID: string | undefined = undefined
        let metreportForSID: string | undefined = undefined
        
        if (isESGG && manualRunwayOverride.value) {
            // Manual override is set: use it and don't pass metreport (to prevent metreport from overriding)
            runwayForSID = manualRunwayOverride.value
            metreportForSID = undefined
        } else {
            // No manual override: pass metreport so it can extract runway from ATIS
            // Don't set runwayForSID - let processRouteWithSID extract it from metreport
            metreportForSID = metreport
        }
        
        // Check if user manually selected a SID (for ESGG)
        if (isESGG && selectedSID.value) {
            sidName = selectedSID.value
            // Still clean the route to remove the SID if it's in there
            cleanedRoute = getCleanedRoute(
                pilot.flight_plan.departure,
                pilot.flight_plan.route,
                runwayForSID,
                metreportForSID,
                effectiveFlightRules
            )
        } else {
            // Extract SID and clean route
            sidName = getSIDName(
                pilot.flight_plan.departure,
                pilot.flight_plan.route,
                runwayForSID,
                metreportForSID,
                effectiveFlightRules
            )
            
            if (sidName) {
                cleanedRoute = getCleanedRoute(
                    pilot.flight_plan.departure,
                    pilot.flight_plan.route,
                    runwayForSID,
                    metreportForSID,
                    effectiveFlightRules
                )
            }
        }
    }

    const success = await vatfsp.printFlightStrip(
        flightData,
        isArrival, // use the parameter or determined value
        pilot.flight_plan.assigned_transponder,
        cleanedRoute, // use cleaned route with SID removed
        formatRFL(pilot.flight_plan.altitude),
        sidName, // pass SID name if found
        undefined, // wtc - not available
    )
    
    if (success) {
        manualCallsign.value = ""
        vatsimFlightPlanFound.value = null
        foundPilot.value = null
        selectedStripType.value = null
        selectedSID.value = null
        showPrintDialog.value = false
    }
}

let checkInterval: number | undefined
let fdpSubscription: any = undefined
let esdataSubscription: any = undefined
let wxSubscription: string | undefined = undefined

function handleRefresh() {
    // Sync FSP state when refresh is triggered
    vatfsp.syncStateFromBackend()
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
    
    // Subscribe to wx for ESGG runway information
    wxSubscription = wx.subscribe('ESGG')
    
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
    if (wxSubscription) {
        wx.unsubscribe(wxSubscription)
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

// Watch for runway changes and reset selected SID
watch(
    () => esggRunwayInUseDisplay.value,
    () => {
        selectedSID.value = null
    }
)
</script>

