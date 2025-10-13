import { defineStore } from "pinia"
import { ref, reactive } from "vue"
import { useSettingsStore } from "./settings"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

export interface FlightData {
    callsign: string
    type?: string
    adep?: string
    ades?: string
    stand?: string
    std?: string
    sta?: string
    eta?: string
    status?: string
    flightRules?: string
}

interface PrintedFlightInfo {
    timestamp: number
    squawk?: string
    route?: string
    rfl?: string
    type?: string
}

// Generate unique client ID
function generateClientId(): string {
    if ("fspClientId" in localStorage) {
        return localStorage.fspClientId
    }
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    localStorage.fspClientId = clientId
    return clientId
}

export const useVatfspStore = defineStore("vatfsp", () => {
    const printing = ref(false)
    const lastError = ref<string | null>(null)
    const printedFlights = reactive<Record<string, PrintedFlightInfo>>({})
    const clientId = generateClientId()
    const backendUrl = ref("")
    const syncInterval = ref<number | undefined>(undefined)

    // Load printed flights from localStorage (fallback)
    if ("fspPrintedFlights" in localStorage) {
        try {
            const stored = JSON.parse(localStorage.fspPrintedFlights)
            Object.assign(printedFlights, stored)
        } catch (e) {
            console.error("Failed to load printed flights", e)
        }
    }

    function savePrintedFlights() {
        localStorage.fspPrintedFlights = JSON.stringify(printedFlights)
    }

    async function syncStateFromBackend(force = false) {
        // Sync printed flights and printing status from backend
        if (!backendUrl.value) return

        try {
            const response = await fetch(`${backendUrl.value}/fsp/state`)
            if (response.ok) {
                const state = await response.json()
                
                // Update printing status
                printing.value = state.printing

                // Update printed flights - ensure reactivity
                const currentKeys = Object.keys(printedFlights)
                const newKeys = Object.keys(state.printedFlights)
                
                // Remove flights that are no longer in backend state
                currentKeys.forEach((key) => {
                    if (!newKeys.includes(key)) {
                        delete printedFlights[key]
                    }
                })
                
                // Add/update flights from backend state
                newKeys.forEach((key) => {
                    printedFlights[key] = state.printedFlights[key]
                })
                
                savePrintedFlights()
                
                if (force) {
                    console.log("FSP: Force synced state from backend")
                }
            }
        } catch (error) {
            console.debug("Failed to sync FSP state from backend:", error)
        }
    }

    async function setPrintingStatus(isPrinting: boolean) {
        if (!backendUrl.value) {
            printing.value = isPrinting
            return true
        }

        try {
            const response = await fetch(`${backendUrl.value}/fsp/printing`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    printing: isPrinting,
                    clientId,
                }),
            })

            if (response.ok) {
                const result = await response.json()
                printing.value = result.printing
                // Immediately sync to get latest state to all clients
                await syncStateFromBackend()
                return true
            } else {
                const error = await response.json()
                console.warn("Failed to set printing status:", error)
                return false
            }
        } catch (error) {
            console.debug("Failed to set printing status:", error)
            printing.value = isPrinting
            return true
        }
    }

    async function markAsPrinted(
        callsign: string,
        squawk?: string,
        route?: string,
        rfl?: string,
        type?: string,
    ) {
        const flightInfo = {
            timestamp: Date.now(),
            squawk,
            route,
            rfl,
            type,
        }

        // Update local state
        printedFlights[callsign] = flightInfo
        savePrintedFlights()

        // Sync to backend
        if (backendUrl.value) {
            try {
                await fetch(`${backendUrl.value}/fsp/printed`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        callsign, 
                        timestamp: flightInfo.timestamp,
                        squawk, 
                        route, 
                        rfl, 
                        type 
                    }),
                })
                // Immediately sync to get latest state to all clients
                await syncStateFromBackend()
            } catch (error) {
                console.debug("Failed to sync printed flight to backend:", error)
            }
        }
    }

    async function printFlightStrip(
        flight: FlightData,
        isArrival: boolean = false,
        squawk?: string,
        route?: string,
        rfl?: string,
        sid?: string,
        wtc?: string,
    ) {
        const settings = useSettingsStore()

        if (!settings.fspUrl) {
            lastError.value = "FSP URL not configured in settings"
            console.error(lastError.value)
            return false
        }

        // Try to lock printing status
        const lockSuccess = await setPrintingStatus(true)
        if (!lockSuccess) {
            lastError.value = "Another client is currently printing"
            console.warn(lastError.value)
            return false
        }

        lastError.value = null

        try {
            // Map to FSP API format
            const fspData: any = {
                callsign: flight.callsign,
                type: isArrival ? "arrival" : "departure",
            }

            // Add optional fields if available
            if (flight.flightRules) fspData.flightRules = flight.flightRules
            if (flight.type) fspData.aircraft = flight.type
            if (wtc) fspData.wtc = wtc
            if (squawk) fspData.transponder = squawk
            if (sid && !isArrival) fspData.sid = sid
            if (flight.adep) fspData.departure = flight.adep
            if (flight.ades) fspData.arrival = flight.ades
            if (route) fspData.route = route
            if (rfl) fspData.rfl = rfl
            if (flight.std) fspData.eobt = flight.std
            if (flight.eta) fspData.eta = flight.eta

            const response = await fetch(`${settings.fspUrl}/api/print/external`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(fspData),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
                lastError.value = `Failed to print: ${errorData.error || response.statusText}`
                console.error(lastError.value, errorData)
                return false
            }

            const result = await response.json()
            
            if (!result.success) {
                lastError.value = result.error || "Print failed"
                console.error(lastError.value)
                return false
            }

            // Mark flight as printed
            await markAsPrinted(flight.callsign, squawk, route, rfl, flight.type)

            console.log(`Successfully sent print request for ${flight.callsign}`)
            return true
        } catch (error: any) {
            lastError.value = `Failed to connect to FSP: ${error.message}`
            console.error(lastError.value)
            return false
        } finally {
            // Unlock printing status
            await setPrintingStatus(false)
        }
    }

    function isPrinted(callsign: string): boolean {
        return callsign in printedFlights
    }

    function hasFlightPlanChanged(
        callsign: string,
        squawk?: string,
        route?: string,
        rfl?: string,
        type?: string,
    ): boolean {
        if (!(callsign in printedFlights)) return false

        const printed = printedFlights[callsign]
        
        if (squawk && printed.squawk !== squawk) return true
        if (route && printed.route !== route) return true
        if (rfl && printed.rfl !== rfl) return true
        if (type && printed.type !== type) return true
        
        return false
    }

    async function clearPrintedFlight(callsign: string) {
        delete printedFlights[callsign]
        savePrintedFlights()

        // Sync to backend
        if (backendUrl.value) {
            try {
                await fetch(`${backendUrl.value}/fsp/printed/${callsign}`, {
                    method: "DELETE",
                })
                // Immediately sync to get latest state to all clients
                await syncStateFromBackend()
            } catch (error) {
                console.debug("Failed to clear printed flight on backend:", error)
            }
        }
    }

    function clearOldPrintedFlights() {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
        for (const callsign in printedFlights) {
            if (printedFlights[callsign].timestamp < oneDayAgo) {
                delete printedFlights[callsign]
            }
        }
        savePrintedFlights()
    }

    async function clearAllPrintedFlights() {
        // Clear local state
        Object.keys(printedFlights).forEach((key) => delete printedFlights[key])
        savePrintedFlights()

        // Sync to backend
        if (backendUrl.value) {
            try {
                await fetch(`${backendUrl.value}/fsp/printed`, {
                    method: "DELETE",
                })
                // Immediately sync to get latest state to all clients
                await syncStateFromBackend()
            } catch (error) {
                console.debug("Failed to clear all printed flights on backend:", error)
            }
        }
    }

    function startSync(apiBaseUrl?: string) {
        backendUrl.value = apiBaseUrl || backendBaseUrl
        
        // Initial sync
        syncStateFromBackend()

        // Poll for updates every 500ms for near real-time syncing
        if (syncInterval.value) {
            clearInterval(syncInterval.value)
        }
        syncInterval.value = window.setInterval(() => {
            syncStateFromBackend()
        }, 500)

        console.log("FSP: Started backend sync with", backendUrl.value)
    }

    function stopSync() {
        if (syncInterval.value) {
            clearInterval(syncInterval.value)
            syncInterval.value = undefined
        }
        backendUrl.value = ""
        console.log("FSP: Stopped backend sync")
    }

    // Clear old printed flights on startup
    clearOldPrintedFlights()

    // Auto-start sync with backend
    startSync()

    return {
        printing,
        lastError,
        printedFlights,
        printFlightStrip,
        isPrinted,
        hasFlightPlanChanged,
        clearPrintedFlight,
        clearOldPrintedFlights,
        clearAllPrintedFlights,
        startSync,
        stopSync,
        syncStateFromBackend,
    }
})

