<template>
    <span v-if="shouldDisplay" class="sector-coverage" style="margin: 0 8px">
        <v-tooltip v-if="positions.testMode" text="Test Mode: Using fake positions" location="bottom">
            <template v-slot:activator="{ props }">
                <span v-bind="props" style="color: orange; margin-right: 4px; font-weight: bold">[TEST]</span>
            </template>
        </v-tooltip>
        
        <!-- Collapsed view for narrow windows -->
        <v-menu
            v-if="shouldCollapse"
            location="bottom"
            :close-on-content-click="false"
            open-on-hover
        >
            <template v-slot:activator="{ props }">
                <span
                    v-bind="props"
                    style="cursor: pointer; text-decoration: underline; text-decoration-style: dotted"
                >
                    <span 
                        @click.stop="toggleModeFilter"
                        style="cursor: pointer; margin-right: 4px;"
                        :title="`Click to filter: ${modeFilter === null ? 'Both' : modeFilter === 'ESMM' ? 'ESMM only' : 'ESOS only'}`"
                    >
                        <span v-if="userSiDisplay" class="sector-covered-by-other">{{ userSiDisplay }}:</span>
                        <span v-else class="sector-covered-by-other">SI:</span>
                    </span>
                </span>
            </template>
            <v-card style="padding: 8px; max-width: 400px; background-color: #2b2d31">
                <div style="white-space: nowrap">
                    <template v-for="(char, index) in displayText" :key="index">
                        <v-tooltip
                            v-if="sectorInfo[index]"
                            :text="sectorInfo[index].tooltip"
                            location="bottom"
                            :transition="false"
                        >
                            <template v-slot:activator="{ props: tooltipProps }">
                                <span
                                    v-bind="tooltipProps"
                                    :class="{
                                        'sector-covered-by-me': sectorInfo[index].coveredBy === 'me',
                                        'sector-covered-by-other': sectorInfo[index].coveredBy === 'other',
                                        'sector-uncovered': sectorInfo[index].coveredBy === 'none',
                                        'sector-hover-highlight': sectorInfo[index].isHovered,
                                    }"
                                    style="cursor: help"
                                    @mouseenter="handleSectorHover(index)"
                                    @mouseleave="handleSectorLeave"
                                >
                                    {{ char }}
                                </span>
                            </template>
                        </v-tooltip>
                        <span v-else>{{ char }}</span>
                    </template>
                </div>
            </v-card>
        </v-menu>
        
        <!-- Expanded view for wide windows -->
        <template v-else>
            <span 
                @click="toggleModeFilter"
                style="cursor: pointer; margin-right: 4px;"
                :title="`Click to filter: ${modeFilter === null ? 'Both' : modeFilter === 'ESMM' ? 'ESMM only' : 'ESOS only'}`"
            >
                <span v-if="userSiDisplay" class="sector-covered-by-other">{{ userSiDisplay }}:</span>
                <span v-else class="sector-covered-by-other">SI:</span>
            </span>
            <template v-for="(char, index) in displayText" :key="index">
                <v-tooltip
                    v-if="sectorInfo[index]"
                    :text="sectorInfo[index].tooltip"
                    location="bottom"
                    :transition="false"
                >
                    <template v-slot:activator="{ props }">
                        <span
                            v-bind="props"
                            :class="{
                                'sector-covered-by-me': sectorInfo[index].coveredBy === 'me',
                                'sector-covered-by-other': sectorInfo[index].coveredBy === 'other',
                                'sector-uncovered': sectorInfo[index].coveredBy === 'none',
                                'sector-hover-highlight': sectorInfo[index].isHovered,
                            }"
                            style="cursor: help"
                            @mouseenter="handleSectorHover(index)"
                            @mouseleave="handleSectorLeave"
                        >
                            {{ char }}
                        </span>
                    </template>
                </v-tooltip>
                <span v-else>{{ char }}</span>
            </template>
        </template>
    </span>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue"
import { usePositionsStore } from "@/stores/positions"
import { useSettingsStore } from "@/stores/settings"
import { useAuthStore } from "@/stores/auth"
import { useVatsimStore } from "@/stores/vatsim"

const positions = usePositionsStore()
const settings = useSettingsStore()
const auth = useAuthStore()
const vatsim = useVatsimStore()

const windowWidth = ref(window.innerWidth)
const hasMenuScrollbar = ref(false)
const collapseThreshold = 1400 // Collapse when window width is less than this

let scrollbarCheckTimeout: number | null = null
let resizeObserver: ResizeObserver | null = null

// Check for scrollbars in menu bar (debounced and safe)
function checkMenuScrollbar() {
    try {
        // Find the app bar
        const appBar = document.querySelector(".v-app-bar")
        if (!appBar) {
            if (hasMenuScrollbar.value !== false) {
                hasMenuScrollbar.value = false
            }
            return
        }

        let foundScrollbar = false

        // Check if app bar itself has horizontal scrollbar
        const appBarEl = appBar as HTMLElement
        if (appBarEl.scrollWidth > appBarEl.clientWidth) {
            foundScrollbar = true
        } else {
            // Check the app bar content area (toolbar content)
            const appBarContent = appBar.querySelector(".v-toolbar__content")
            if (appBarContent) {
                const contentEl = appBarContent as HTMLElement
                if (contentEl.scrollWidth > contentEl.clientWidth) {
                    foundScrollbar = true
                }
            }

            // Check menu items container (the span with overflow: auto in MainMenu)
            // Only check spans that are direct children or have overflow styles
            if (!foundScrollbar) {
                const menuContainers = Array.from(appBar.querySelectorAll("span"))
                for (const container of menuContainers) {
                    const el = container as HTMLElement
                    const style = window.getComputedStyle(el)
                    // Only check if overflow is explicitly set to auto/scroll
                    if (style.overflowX === "auto" || style.overflowX === "scroll") {
                        if (el.scrollWidth > el.clientWidth) {
                            foundScrollbar = true
                            break
                        }
                    }
                }
            }
        }

        // Only update if value changed to avoid unnecessary re-renders
        if (hasMenuScrollbar.value !== foundScrollbar) {
            hasMenuScrollbar.value = foundScrollbar
        }
    } catch (e) {
        console.error("Error checking menu scrollbar:", e)
        if (hasMenuScrollbar.value !== false) {
            hasMenuScrollbar.value = false
        }
    }
}

// Debounced version of checkMenuScrollbar
function debouncedCheckMenuScrollbar() {
    if (scrollbarCheckTimeout !== null) {
        clearTimeout(scrollbarCheckTimeout)
    }
    scrollbarCheckTimeout = window.setTimeout(() => {
        checkMenuScrollbar()
        scrollbarCheckTimeout = null
    }, 200)
}

// Watch window resize and check for scrollbars
onMounted(() => {
    let resizeTimeout: number | null = null
    
    const handleResize = () => {
        windowWidth.value = window.innerWidth
        
        // Debounce scrollbar check
        if (resizeTimeout !== null) {
            clearTimeout(resizeTimeout)
        }
        resizeTimeout = window.setTimeout(() => {
            debouncedCheckMenuScrollbar()
            resizeTimeout = null
        }, 300)
    }
    window.addEventListener("resize", handleResize, { passive: true })
    
    // Use ResizeObserver on the app bar - only fires when size actually changes
    const appBar = document.querySelector(".v-app-bar")
    if (appBar && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
            // Only check scrollbar, don't update width here
            debouncedCheckMenuScrollbar()
        })
        resizeObserver.observe(appBar)
    }
    
    // Initial check after a delay to ensure DOM is ready
    const initialTimeout = setTimeout(() => {
        checkMenuScrollbar()
    }, 500)
    
    onUnmounted(() => {
        window.removeEventListener("resize", handleResize)
        if (resizeTimeout !== null) clearTimeout(resizeTimeout)
        if (scrollbarCheckTimeout !== null) clearTimeout(scrollbarCheckTimeout)
        if (resizeObserver) {
            resizeObserver.disconnect()
            resizeObserver = null
        }
        clearTimeout(initialTimeout)
    })
    
    // Auto-detect mode on mount
    if (!modeFilterManuallySet.value) {
        const detectedMode = detectUserMode()
        modeFilter.value = detectedMode || "ESMM"
    }
})

// Determine if we should collapse the display
// Use a computed that checks both conditions
const shouldCollapse = computed(() => {
    return windowWidth.value < collapseThreshold || hasMenuScrollbar.value
})

interface SectorInfo {
    tooltip: string
    coveredBy: "me" | "other" | "none"
    isHovered: boolean
}

// Get user's current position callsign to determine mode
const userCallsign = computed(() => {
    if (settings.useVatsimConnect && auth.user?.cid) {
        const cid = auth.user.cid.toString()
        const controller = vatsim.data?.controllers?.find((c) => c.cid.toString() === cid)
        return controller?.callsign || ""
    } else if (settings.cid1) {
        const controller = vatsim.data?.controllers?.find((c) => c.cid.toString() === settings.cid1)
        return controller?.callsign || ""
    }
    return settings.position1 || ""
})

// Mode filter: "ESMM" or "ESOS" only (no dual mode)
const modeFilter = ref<"ESMM" | "ESOS" | null>(null)
const modeFilterManuallySet = ref(false)

// Auto-detect mode from user's position
function detectUserMode(): "ESMM" | "ESOS" | null {
    // First check user's positions
    const myPositions = positions.getMyPositions()
    if (myPositions.length > 0) {
        for (const si of myPositions) {
            const sectors = positions.getPositionSectors(si)
            for (const sector of sectors) {
                if (sector.includes("ESMM")) return "ESMM"
                if (sector.includes("ESOS")) return "ESOS"
            }
        }
    }
    
    // Also check all active positions (for test mode)
    for (const si of positions.activePositions.keys()) {
        const sectors = positions.getPositionSectors(si)
        for (const sector of sectors) {
            if (sector.includes("ESMM")) return "ESMM"
            if (sector.includes("ESOS")) return "ESOS"
        }
    }
    
    // Check callsign
    const callsign = userCallsign.value
    if (callsign.includes("ESMM")) return "ESMM"
    if (callsign.includes("ESOS")) return "ESOS"
    return null
}

// Toggle mode filter: ESMM <-> ESOS
function toggleModeFilter() {
    modeFilterManuallySet.value = true
    if (modeFilter.value === "ESMM") {
        modeFilter.value = "ESOS"
    } else {
        modeFilter.value = "ESMM"
    }
}

// Determine mode (ESOS or ESMM) from callsign or test mode or filter
const mode = computed(() => {
    // If mode filter is set, use it
    if (modeFilter.value) {
        return modeFilter.value
    }
    
    // Otherwise auto-detect
    const detectedMode = detectUserMode()
    if (detectedMode) {
        return detectedMode
    }
    
    // Default to ESMM
    return "ESMM"
})

// Get user's position SIs
const myPositions = computed(() => positions.getMyPositions())

// Get user's SI for display (first position, or empty if none)
const userSiDisplay = computed(() => {
    if (myPositions.value.length > 0) {
        // Get the first position SI and remove underscores
        return myPositions.value[0].replace(/_/g, '')
    }
    return ''
})

// Get all sectors for the mode
const modeSectors = computed(() => {
    if (!mode.value) return []
    return positions.getSectorsForMode(mode.value)
})

// Get position SI for display (first one if multiple)
const displayPositionSi = computed(() => {
    // In test mode, show active positions even without user configuration
    if (positions.testMode) {
        const activeSis = Array.from(positions.activePositions.keys())
        if (activeSis.length > 0) {
            // Try to find a position that matches the mode
            if (mode.value) {
                for (const si of activeSis) {
                    const sectors = positions.getPositionSectors(si)
                    for (const sector of sectors) {
                        if (sector.includes(mode.value)) {
                            return si
                        }
                    }
                }
            }
            // Fallback to first active position
            return activeSis[0]
        }
    }
    
    // Normal mode: require user position
    if (myPositions.value.length === 0) return null
    
    // Try to find a position that matches the mode
    for (const si of myPositions.value) {
        const sectors = positions.getPositionSectors(si)
        for (const sector of sectors) {
            if (mode.value && sector.includes(mode.value)) {
                return si
            }
        }
    }
    
    // Fallback to first position
    return myPositions.value[0]
})

// Get all sectors for the mode (show all, not just ones this position can cover)
const allPossibleSectors = computed(() => {
    if (!mode.value) return []
    
    const possibleSectors: string[] = []
    for (const [sectorName, sector] of positions.sectors.entries()) {
        // Filter by mode - show all sectors for this mode
        if (sectorName.includes(mode.value)) {
            possibleSectors.push(sectorName)
        }
    }
    return possibleSectors
})

// Helper to get sorted sector arrays by mode
// Extract sector IDs and sort them
const sectorIds = computed(() => {
    const ids = allPossibleSectors.value.map((s) => positions.extractSectorId(s)).filter((id) => id)
    
    // ESOS has a specific sort order: 12346789FNK
    if (mode.value === "ESOS") {
        const esosOrder = ["1", "2", "3", "4", "6", "7", "8", "9", "F", "N", "K"]
        return ids.sort((a, b) => {
            const aIndex = esosOrder.indexOf(a)
            const bIndex = esosOrder.indexOf(b)
            // If both are in the order list, sort by their position
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
            // If only one is in the list, prioritize it
            if (aIndex !== -1) return -1
            if (bIndex !== -1) return 1
            // If neither is in the list, use default sort
            const aNum = parseInt(a)
            const bNum = parseInt(b)
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
            if (!isNaN(aNum)) return -1
            if (!isNaN(bNum)) return 1
            return a.localeCompare(b)
        })
    }
    
    // ESMM: Sort: numbers first, then letters
    return ids.sort((a, b) => {
        const aNum = parseInt(a)
        const bNum = parseInt(b)
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
        if (!isNaN(aNum)) return -1
        if (!isNaN(bNum)) return 1
        return a.localeCompare(b)
    })
})

// Build display text (only sectors, no position SI prefix)
const displayText = computed(() => {
    if (sectorIds.value.length === 0) return ""
    return sectorIds.value.join("")
})

// Check if sector coverage should be displayed
const shouldDisplay = computed(() => {
    return settings.showSectorCoverage && (displayText.value.length > 0 || positions.testMode)
})

// Track hovered sector ID
const hoveredSectorId = ref<string | null>(null)

// Get sectors covered by the same position as the hovered sector
const hoveredPositionSectors = computed(() => {
    if (!hoveredSectorId.value) return new Set<string>()
    
    const sectorId = hoveredSectorId.value
    
    // Find the sector name for the hovered sector ID and current mode
    const hoveredSectorName = allPossibleSectors.value.find(
        (s) => positions.extractSectorId(s) === sectorId && s.includes(mode.value)
    )
    
    if (!hoveredSectorName) return new Set<string>()
    
    // Get the position covering the hovered sector
    const controllerSi = positions.getSectorController(hoveredSectorName)
    if (!controllerSi) return new Set<string>()
    
    // Get all sectors covered by that same position, but only from the current mode
    const sectors = positions.getPositionSectors(controllerSi)
    const sectorIdSet = new Set<string>()
    for (const sector of sectors) {
        // Only include sectors from the current mode
        if (sector.includes(mode.value)) {
            const id = positions.extractSectorId(sector)
            if (id) {
                sectorIdSet.add(id)
            }
        }
    }
    
    return sectorIdSet
})

const sectorInfo = computed(() => {
    const info: (SectorInfo | null)[] = []
    
    // Build a map: character index -> sector ID
    const charToSectorId = new Map<number, string>()
    let charPos = 0
    for (const sectorId of sectorIds.value) {
        for (let i = 0; i < sectorId.length; i++) {
            charToSectorId.set(charPos + i, sectorId)
        }
        charPos += sectorId.length
    }
    
    // Build info array
    for (let i = 0; i < displayText.value.length; i++) {
        const sectorId = charToSectorId.get(i)
        if (sectorId) {
            // Find the sector name matching the ID and current mode
            const sectorName = allPossibleSectors.value.find(
                (s) => positions.extractSectorId(s) === sectorId && s.includes(mode.value)
            )
            
            if (sectorName) {
                const controllerSi = positions.getSectorController(sectorName)
                const isMySector = myPositions.value.includes(controllerSi || "")
                const isCovered = controllerSi !== null
                
                // Determine base coverage state (always preserve original state)
                const baseCoveredBy: "me" | "other" | "none" = isMySector ? "me" : isCovered ? "other" : "none"
                
                // Determine if this sector should be highlighted on hover
                const isHovered = !!(hoveredSectorId.value && hoveredPositionSectors.value.has(sectorId))
                
                info.push({
                    tooltip: isCovered
                        ? `${mode.value} ${sectorId}: ${controllerSi?.replace(/_/g, '') || ''}`
                        : `${mode.value} ${sectorId}: Not covered`,
                    coveredBy: baseCoveredBy,
                    isHovered: isHovered,
                })
            } else {
                info.push(null)
            }
        } else {
            info.push(null)
        }
    }
    
    return info
})

// Handle sector hover
function handleSectorHover(index: number) {
    // Build character index to sector ID map
    let charPos = 0
    for (const sectorId of sectorIds.value) {
        if (index >= charPos && index < charPos + sectorId.length) {
            hoveredSectorId.value = sectorId
            return
        }
        charPos += sectorId.length
    }
    hoveredSectorId.value = null
}

function handleSectorLeave() {
    hoveredSectorId.value = null
}

// Update mode filter when positions change
watch(
    () => [positions.activePositions, myPositions.value],
    () => {
        // Only auto-set if mode filter was not manually set by user
        if (!modeFilterManuallySet.value) {
            const detectedMode = detectUserMode()
            if (detectedMode) {
                modeFilter.value = detectedMode
            }
        }
    },
    { deep: true, immediate: true }
)

</script>

<style scoped>
.sector-covered-by-me {
    color: #e0e0e0;
    font-weight: bold;
}

.sector-covered-by-other {
    color: #9e9e9e;
}

.sector-uncovered {
    color: #555;
}

.sector-hover-highlight {
    color: #ffd700;
}

/* Disable tooltip transitions */
:deep(.v-tooltip),
:deep(.v-overlay__content),
:deep(.v-overlay__scrim) {
    transition: none !important;
    animation: none !important;
}

:deep(.v-overlay__content) {
    opacity: 1 !important;
}
</style>
