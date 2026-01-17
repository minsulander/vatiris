import { defineStore } from "pinia"
import { computed, reactive, ref, watch } from "vue"
import { useVatsimStore, type Controller } from "./vatsim"
import { useSettingsStore } from "./settings"
import { useAuthStore } from "./auth"
import sectorsTxt from "@/data/sectors.txt?raw"
import callsignsTxt from "@/data/callsigns.txt?raw"

export interface Sector {
    name: string
    owners: string[] // Ordered list of position SI identifiers
}

export interface PositionInfo {
    callsign: string
    si: string
    description: string
}

export const usePositionsStore = defineStore("positions", () => {
    const vatsim = useVatsimStore()
    const settings = useSettingsStore()
    const auth = useAuthStore()

    // Parsed data
    const sectors = reactive(new Map<string, Sector>())
    const callsignToPosition = reactive(new Map<string, PositionInfo>())
    const siToCallsigns = reactive(new Map<string, string[]>()) // SI -> list of callsigns

    // Active positions: SI -> Controller
    const activePositions = reactive(new Map<string, Controller>())

    // Test mode: fake active positions for testing
    const testMode = ref(localStorage.getItem("positions-test-mode") === "true")
    const fakeActivePositions = reactive(new Map<string, Partial<Controller>>())

    // Manual override for sector coverage positions (for testing/debug)
    // This is separate from PLS settings and only affects sector coverage highlighting
    const manualSectorCoverageCid = ref<string | null>(localStorage.getItem("sector-coverage-cid") || null)
    const manualSectorCoverageSis = ref<string[]>(() => {
        const stored = localStorage.getItem("sector-coverage-sis")
        if (stored) {
            try {
                return JSON.parse(stored)
            } catch {
                return []
            }
        }
        return []
    })

    // Parse sectors.txt
    function parseSectors() {
        sectors.clear()
        const lines = sectorsTxt.split("\n")
        let currentSector: Sector | null = null

        for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith("SECTOR:")) {
                if (currentSector) {
                    sectors.set(currentSector.name, currentSector)
                }
                const sectorName = trimmed.substring(7).trim()
                currentSector = {
                    name: sectorName,
                    owners: [],
                }
            } else if (trimmed.startsWith("OWNER:") && currentSector) {
                const ownersStr = trimmed.substring(6).trim()
                currentSector.owners = ownersStr.split(":").filter((o) => o.length > 0)
            }
        }
        if (currentSector) {
            sectors.set(currentSector.name, currentSector)
        }
        console.log(`Parsed ${sectors.size} sectors`)
    }

    // Parse callsigns.txt
    function parseCallsigns() {
        callsignToPosition.clear()
        siToCallsigns.clear()
        const lines = callsignsTxt.split("\n")

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            const parts = trimmed.split(":")
            if (parts.length < 4) continue

            const callsign = parts[0]
            const description = parts[1] || ""
            const si = parts[3] || ""

            if (callsign && si) {
                callsignToPosition.set(callsign, {
                    callsign,
                    si,
                    description,
                })

                if (!siToCallsigns.has(si)) {
                    siToCallsigns.set(si, [])
                }
                siToCallsigns.get(si)!.push(callsign)
            }
        }
        console.log(`Parsed ${callsignToPosition.size} positions`)
    }

    // Update active positions from VATSIM data or test mode
    function updateActivePositions() {
        activePositions.clear()

        // If test mode is enabled, use fake positions
        if (testMode.value) {
            for (const [si, fakeController] of fakeActivePositions.entries()) {
                // Get a real callsign for this SI to create a proper controller object
                const callsigns = siToCallsigns.get(si)
                let callsign = fakeController.callsign
                
                // If no callsign provided, try to get one from callsigns.txt
                if (!callsign && callsigns && callsigns.length > 0) {
                    callsign = callsigns[0]
                }
                
                // If still no callsign, create a default one based on SI
                if (!callsign) {
                    // Try to infer callsign from SI (e.g., "M5" -> "ESMM_5_CTR")
                    if (si.startsWith("M")) {
                        callsign = `ESMM_${si.substring(1)}_CTR`
                    } else if (si.startsWith("S")) {
                        callsign = `ESOS_${si.substring(1)}_CTR`
                    } else {
                        callsign = `TEST_${si}_CTR`
                    }
                }
                
                // Create a controller object with fake data
                const controller: Controller = {
                    callsign: callsign,
                    cid: fakeController.cid || 999999,
                    facility: fakeController.facility || 0,
                    frequency: fakeController.frequency || "0.000",
                    last_updated: fakeController.last_updated || new Date().toISOString(),
                    logon_time: fakeController.logon_time || new Date().toISOString(),
                    name: fakeController.name || `Test Controller ${si}`,
                    rating: fakeController.rating || 0,
                    server: fakeController.server || "TEST",
                    visual_range: fakeController.visual_range || 0,
                }
                activePositions.set(si, controller)
            }
            return
        }

        // Normal mode: use real VATSIM data
        if (!vatsim.data || !vatsim.data.controllers) return

        for (const controller of vatsim.data.controllers) {
            const positionInfo = callsignToPosition.get(controller.callsign)
            if (positionInfo) {
                activePositions.set(positionInfo.si, controller)
            }
        }
    }

    // Test mode functions
    function setTestMode(enabled: boolean) {
        testMode.value = enabled
        if (enabled) {
            localStorage.setItem("positions-test-mode", "true")
        } else {
            localStorage.removeItem("positions-test-mode")
            fakeActivePositions.clear()
        }
        updateActivePositions()
    }

    function setFakePosition(si: string, controller?: Partial<Controller>) {
        if (!testMode.value) {
            console.warn("Test mode is not enabled. Call setTestMode(true) first.")
            return
        }
        fakeActivePositions.set(si, controller || {})
        updateActivePositions()
    }

    function removeFakePosition(si: string) {
        fakeActivePositions.delete(si)
        updateActivePositions()
    }

    function clearFakePositions() {
        fakeActivePositions.clear()
        updateActivePositions()
    }

    // Watch test mode changes
    watch(testMode, () => {
        updateActivePositions()
    })

    // Watch VATSIM data for changes
    watch(
        () => vatsim.data?.controllers,
        () => {
            updateActivePositions()
        },
        { deep: true },
    )

    // Computed: sector -> controlling position SI
    const sectorToPosition = computed(() => {
        const mapping = new Map<string, string | null>()
        for (const [sectorName, sector] of sectors.entries()) {
            // Find first active position in OWNER list
            let controller: string | null = null
            for (const ownerSi of sector.owners) {
                if (activePositions.has(ownerSi)) {
                    controller = ownerSi
                    break
                }
            }
            mapping.set(sectorName, controller)
        }
        return mapping
    })

    // Computed: position SI -> list of sectors it controls
    const positionToSectors = computed(() => {
        const mapping = new Map<string, string[]>()
        for (const [sectorName, controllerSi] of sectorToPosition.value.entries()) {
            if (controllerSi) {
                if (!mapping.has(controllerSi)) {
                    mapping.set(controllerSi, [])
                }
                mapping.get(controllerSi)!.push(sectorName)
            }
        }
        return mapping
    })

    // Get sector controller
    function getSectorController(sectorName: string): string | null {
        return sectorToPosition.value.get(sectorName) || null
    }

    // Get sectors for a position
    function getPositionSectors(si: string): string[] {
        return positionToSectors.value.get(si) || []
    }

    // Get my positions for sector coverage (only VATSIM Connect CID or manual override)
    function getMyPositions(): string[] {
        const mySis: string[] = []

        // Priority 1: Manual override (for testing/debug)
        if (manualSectorCoverageSis.value.length > 0) {
            return [...manualSectorCoverageSis.value]
        }

        // Priority 2: Manual CID override (for testing/debug)
        if (manualSectorCoverageCid.value) {
            for (const [callsign, controller] of activePositions.entries()) {
                if (controller.cid.toString() === manualSectorCoverageCid.value) {
                    const posInfo = callsignToPosition.get(controller.callsign)
                    if (posInfo && !mySis.includes(posInfo.si)) {
                        mySis.push(posInfo.si)
                    }
                }
            }
            if (mySis.length > 0) {
                return mySis
            }
        }

        // Priority 3: VATSIM Connect CID (automatic)
        if (auth.user?.cid) {
            const cid = auth.user.cid.toString()
            for (const [callsign, controller] of activePositions.entries()) {
                if (controller.cid.toString() === cid) {
                    const posInfo = callsignToPosition.get(controller.callsign)
                    if (posInfo && !mySis.includes(posInfo.si)) {
                        mySis.push(posInfo.si)
                    }
                }
            }
        }

        return mySis
    }

    // Set manual CID for sector coverage (for testing/debug)
    function setSectorCoverageCid(cid: string | null) {
        manualSectorCoverageCid.value = cid
        if (cid) {
            localStorage.setItem("sector-coverage-cid", cid)
        } else {
            localStorage.removeItem("sector-coverage-cid")
        }
    }

    // Set manual position SIs for sector coverage (for testing/debug)
    function setSectorCoverageSis(sis: string[]) {
        manualSectorCoverageSis.value = [...sis]
        if (sis.length > 0) {
            localStorage.setItem("sector-coverage-sis", JSON.stringify(sis))
        } else {
            localStorage.removeItem("sector-coverage-sis")
        }
    }

    // Clear manual overrides
    function clearSectorCoverageOverride() {
        manualSectorCoverageCid.value = null
        manualSectorCoverageSis.value = []
        localStorage.removeItem("sector-coverage-cid")
        localStorage.removeItem("sector-coverage-sis")
    }

    // Get sectors for a mode (ESOS or ESMM)
    function getSectorsForMode(mode: "ESOS" | "ESMM"): string[] {
        const result: string[] = []
        for (const sectorName of sectors.keys()) {
            if (sectorName.includes(mode)) {
                result.push(sectorName)
            }
        }
        return result
    }

    // Extract sector ID from sector name (e.g., "ESAA·ESMM 2" -> "2")
    function extractSectorId(sectorName: string): string {
        // Handle format: "ESAA·ESMM 2" or "ESAA·ESMM K" or "ESAA·ESOS 7-2·095·175:09500:17500"
        const match = sectorName.match(/ESAA·(ESMM|ESOS)\s+([\w-]+)/)
        if (match) {
            return match[2]
        }
        return ""
    }

    // Convert sectors.txt name to occupancy-sectors.json format
    // "ESAA·ESMM 2" -> "ESMM2", "ESAA·ESOS F" -> "ESOSF"
    function convertToOccupancySectorName(sectorName: string): string {
        const match = sectorName.match(/ESAA·(ESMM|ESOS)\s+([\w-]+)/)
        if (match) {
            const mode = match[1]
            const id = match[2]
            return `${mode}${id}`
        }
        return ""
    }

    // Get occupancy sector names for a position
    function getOccupancySectorsForPosition(si: string): string[] {
        const sectorNames = getPositionSectors(si)
        const occupancyNames: string[] = []
        for (const sectorName of sectorNames) {
            const occupancyName = convertToOccupancySectorName(sectorName)
            if (occupancyName) {
                occupancyNames.push(occupancyName)
            }
        }
        return occupancyNames
    }

    // Initialize
    parseSectors()
    parseCallsigns()
    updateActivePositions()

    // Expose test mode functions to window for console access
    if (typeof window !== "undefined") {
        ;(window as any).positionsTestMode = {
            enable: () => setTestMode(true),
            disable: () => setTestMode(false),
            toggle: () => setTestMode(!testMode.value),
            isEnabled: () => testMode.value,
            setPosition: (si: string, controller?: Partial<Controller>) => setFakePosition(si, controller),
            removePosition: (si: string) => removeFakePosition(si),
            clear: () => clearFakePositions(),
            list: () => Array.from(fakeActivePositions.keys()),
            help: () => {
                console.log(`
Positions Test Mode Commands:
  positionsTestMode.enable()           - Enable test mode (works without sign-in)
  positionsTestMode.disable()          - Disable test mode
  positionsTestMode.toggle()           - Toggle test mode
  positionsTestMode.isEnabled()        - Check if test mode is enabled
  positionsTestMode.setPosition(si)    - Add fake position (e.g., "M5", "S1")
  positionsTestMode.removePosition(si) - Remove fake position
  positionsTestMode.clear()            - Clear all fake positions
  positionsTestMode.list()             - List all fake positions

Examples:
  positionsTestMode.enable()
  positionsTestMode.setPosition("M5")
  positionsTestMode.setPosition("S1", { name: "Test Controller" })
  positionsTestMode.setPosition("M2")
  positionsTestMode.setPosition("M3")
  
Note: In test mode, sector coverage display works even without signing in!
                `)
            },
        }
        console.log("Positions test mode available. Type positionsTestMode.help() for commands.")

        // Expose sector coverage debug functions to window for console access
        ;(window as any).sectorCoverage = {
            setCid: (cid: string | null) => setSectorCoverageCid(cid),
            setSis: (sis: string[]) => setSectorCoverageSis(sis),
            clear: () => clearSectorCoverageOverride(),
            getCurrent: () => getMyPositions(),
            getCid: () => manualSectorCoverageCid.value,
            getSis: () => [...manualSectorCoverageSis.value],
            help: () => {
                console.log(`
Sector Coverage Debug Commands:
  sectorCoverage.setCid(cid)           - Set manual CID for sector coverage (e.g., "123456")
  sectorCoverage.setCid(null)          - Clear CID override
  sectorCoverage.setSis(["M5", "S1"])   - Set manual position SIs (overrides CID)
  sectorCoverage.setSis([])             - Clear SI override
  sectorCoverage.clear()                - Clear all overrides (use VATSIM Connect CID)
  sectorCoverage.getCurrent()           - Get current detected positions
  sectorCoverage.getCid()               - Get current manual CID override
  sectorCoverage.getSis()               - Get current manual SI override

Priority order:
  1. Manual SI override (setSis)
  2. Manual CID override (setCid)
  3. VATSIM Connect CID (automatic)

Examples:
  sectorCoverage.setCid("123456")       - Use CID 123456 for sector coverage
  sectorCoverage.setSis(["M5"])         - Manually set position M5
  sectorCoverage.clear()                 - Use VATSIM Connect CID only
                `)
            },
        }
        console.log("Sector coverage debug available. Type sectorCoverage.help() for commands.")
    }

    return {
        sectors,
        callsignToPosition,
        activePositions,
        sectorToPosition,
        positionToSectors,
        testMode,
        fakeActivePositions,
        getSectorController,
        getPositionSectors,
        getMyPositions,
        getSectorsForMode,
        extractSectorId,
        convertToOccupancySectorName,
        getOccupancySectorsForPosition,
        setTestMode,
        setFakePosition,
        removeFakePosition,
        clearFakePositions,
        setSectorCoverageCid,
        setSectorCoverageSis,
        clearSectorCoverageOverride,
    }
})
