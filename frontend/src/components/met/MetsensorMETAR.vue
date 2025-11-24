<template>
    <div v-if="noData" class="pa-3 text-center">NO DATA</div>
    <div
        v-else
        class="metsensor"
        :class="changed ? 'flash' : ''"
        style="height: 100%"
        @click="click"
    >
        <div style="position: relative">
            <!-- Timestamp - top right, or left of runway buttons if they exist -->
            <div
                :style="{ position: 'absolute', top: '0', right: timestampOffset, zIndex: 100 }"
                class="text-caption font-weight-bold"
                :class="outdated ? 'text-orange-darken-4' : ''"
            >
                {{ formattedTime }}
            </div>
            <!-- Runway selector - only show when more than one runway (more than 2 runway ends) -->
            <div v-if="showRunwaySelector" class="runway-selector" style="position: absolute; top: 0; right: 0; display: flex; gap: 0; pointer-events: auto; padding: 0; z-index: 101;">
                <template v-for="rwy in availableRunways" :key="rwy">
                    <a
                        :title="`Select runway ${rwy}`"
                        class="px-1 font-weight-bold text-caption"
                        @click="selectedRunway = rwy"
                        :style="{ color: currentRunway === rwy ? '#444' : '#999', cursor: 'pointer', userSelect: 'none', textDecoration: 'none' }"
                        >{{ rwy }}</a
                    >
                </template>
            </div>
        </div>
        <div style="height: 100%; display: flex; justify-content: center; align-items: center">
            <pre
                class="pa-1"
                style="display: inline-block; text-align: left; font-size: 14px; line-height: 16px"
                v-html="metsensorStylized"
            ></pre>
        </div>
    </div>
</template>

<style>
.metsensor span.changed {
    transition:
        background-color 0.25s,
        color 0.25s;
}
.metsensor.flash span.changed {
    background-color: #66f;
    color: #ddd;
}
.metsensor .leqnh,
.metsensor .leqnh span.changed {
    display: inline;
    font-size: 21px;
    font-weight: 700 !important;
}
</style>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue"
import { useMetarStore } from "@/stores/metar"
import { useSmhiStore } from "@/stores/smhi"
import { useWindStore } from "@/stores/wind"
import { diffWords } from "diff"
import { useSettingsStore } from "@/stores/settings"
import { calculateTrl } from "@/metcommon"
import moment from "moment"
import Papa from "papaparse"
import airportsData from "@/data/airports.csv?raw"
import runwaysData from "@/data/runways.csv?raw"

const props = defineProps<{ id: string }>()

const metar = useMetarStore()
const smhi = useSmhiStore()
const windStore = useWindStore()
const settings = useSettingsStore()

// Load airport elevations from CSV
const airportElevations: { [key: string]: number } = {}
try {
    const parsed = Papa.parse(airportsData, { header: true, skipEmptyLines: true })
    parsed.data.forEach((row: any) => {
        if (row.ident && row.elevation_ft) {
            const elevationFt = parseFloat(row.elevation_ft)
            if (!isNaN(elevationFt)) {
                airportElevations[row.ident.toUpperCase()] = elevationFt
            }
        }
    })
} catch (error: any) {
    console.error("Error loading airport elevations:", error.message)
}

// Get airport elevation in feet
const airportElevationFt = computed(() => {
    return airportElevations[props.id] || 0
})

// Load runway threshold elevations from CSV
interface RunwayThreshold {
    leElevationFt: number
    heElevationFt: number
}

const runwayThresholds: { [key: string]: { [rwy: string]: RunwayThreshold } } = {}
try {
    const parsed = Papa.parse(runwaysData, { header: true, skipEmptyLines: true })
    parsed.data.forEach((row: any) => {
        if (row.airport_ident && row.le_ident && row.he_ident) {
            const icao = row.airport_ident.toUpperCase()
            const leIdent = row.le_ident.toUpperCase()
            const heIdent = row.he_ident.toUpperCase()
            const leElevationFt = parseFloat(row.le_elevation_ft) || 0
            const heElevationFt = parseFloat(row.he_elevation_ft) || 0
            
            if (!runwayThresholds[icao]) {
                runwayThresholds[icao] = {}
            }
            
            // Store by both LE and HE identifiers
            const rwyPair = `${leIdent}/${heIdent}`
            runwayThresholds[icao][rwyPair] = {
                leElevationFt,
                heElevationFt,
            }
            // Also store by individual runway ends
            runwayThresholds[icao][leIdent] = {
                leElevationFt,
                heElevationFt,
            }
            runwayThresholds[icao][heIdent] = {
                leElevationFt,
                heElevationFt,
            }
        }
    })
} catch (error: any) {
    console.error("Error loading runway threshold elevations:", error.message)
}

// Get runway threshold elevations for current runway pair
const currentRunwayThresholds = computed(() => {
    if (!props.id || !currentRunway.value) return null
    const icaoThresholds = runwayThresholds[props.id]
    if (!icaoThresholds) return null
    
    // Try to find by pair first (e.g., "03/21")
    if (icaoThresholds[currentRunway.value]) {
        return icaoThresholds[currentRunway.value]
    }
    
    // Try to find by individual runway ends
    const runways = currentRunway.value.split("/")
    if (runways.length === 2) {
        const leThreshold = icaoThresholds[runways[0]]
        const heThreshold = icaoThresholds[runways[1]]
        if (leThreshold && heThreshold) {
            return {
                leElevationFt: leThreshold.leElevationFt,
                heElevationFt: heThreshold.heElevationFt,
            }
        }
    }
    
    return null
})

// Runway selection
const selectedRunway = ref("")

// Calculate timestamp offset based on runway button widths
const timestampOffset = computed(() => {
    if (!showRunwaySelector.value || availableRunways.value.length === 0) {
        return "3px"
    }
    // Calculate total width needed for all runway buttons
    // Each button: text width (~8px per char) + padding (px-1 = 4px each side = 8px) + minimal spacing
    let totalWidth = 0
    availableRunways.value.forEach((rwy: string) => {
        // Estimate ~8px per character for text-caption font size
        const textWidth = rwy.length * 8
        // px-1 padding = 4px left + 4px right = 8px total
        const paddingWidth = 8
        // Button width
        totalWidth += textWidth + paddingWidth + 2 // +2 for minimal spacing between buttons
    })
    // Position timestamp close to buttons
    return `${Math.max(3, totalWidth - 10)}px`
})

// Get available runway pairs (e.g., "03/21", "10/28") from wind store
const availableRunways = computed(() => {
    if (!props.id || !windStore.windData[props.id]) return []
    const runways = windStore.windData[props.id].runways
    
    // Group runway ends into pairs based on opposite headings
    const pairs: string[] = []
    const processed = new Set<string>()
    
    for (let i = 0; i < runways.length; i++) {
        const rwy1 = runways[i]
        if (processed.has(rwy1.name)) continue
        
        // Get runway number without suffix (e.g., "03" from "03L")
        const rwy1Num = rwy1.name.replace(/[LRC]$/, "")
        const heading1 = rwy1.heading || 0
        
        // Find opposite runway (heading differs by ~180 degrees)
        let oppositeFound = false
        for (let j = i + 1; j < runways.length; j++) {
            const rwy2 = runways[j]
            if (processed.has(rwy2.name)) continue
            
            const heading2 = rwy2.heading || 0
            // Calculate the difference considering wraparound (0-360 degrees)
            let diff = Math.abs(heading1 - heading2)
            if (diff > 180) diff = 360 - diff
            
            // If headings are approximately opposite (within 10 degrees of 180)
            if (Math.abs(diff - 180) < 10) {
                // Preserve L/R/C designators when creating pairs
                const pair = [rwy1.name, rwy2.name].sort((a, b) => {
                    const aNum = parseInt(a.replace(/[LRC]$/, ""))
                    const bNum = parseInt(b.replace(/[LRC]$/, ""))
                    return aNum - bNum
                })
                pairs.push(pair.join("/"))
                processed.add(rwy1.name)
                processed.add(rwy2.name)
                oppositeFound = true
                break
            }
        }
        
        // If no opposite found, treat as single runway (shouldn't happen normally)
        if (!oppositeFound && !processed.has(rwy1.name)) {
            pairs.push(rwy1.name)
            processed.add(rwy1.name)
        }
    }
    
    // Sort pairs by first runway number
    return pairs.sort((a, b) => {
        const aNum = parseInt(a.split("/")[0].replace(/[LRC]$/, ""))
        const bNum = parseInt(b.split("/")[0].replace(/[LRC]$/, ""))
        return aNum - bNum
    })
})

// Current runway pair - use selected or default to first available
const currentRunway = computed(() => {
    if (selectedRunway.value) return selectedRunway.value
    const defaultRunway = windStore.getRunwayInUse(props.id)
    if (defaultRunway) {
        // Find which pair contains the default runway (check both with and without designator)
        const defaultNum = defaultRunway.replace(/[LRC]$/, "")
        const pair = availableRunways.value.find(p => p.includes(defaultRunway) || p.includes(defaultNum))
        if (pair) return pair
    }
    return availableRunways.value[0] || ""
})

// Show runway selector only if there are more than one runway (more than 2 runway ends)
const showRunwaySelector = computed(() => {
    if (!props.id || !windStore.windData[props.id]) return false
    const runways = windStore.windData[props.id].runways
    // Show selector if there are more than 2 runway ends (more than one runway)
    return runways.length > 2
})

const time = computed(() => {
    // Prefer SMHI timestamp, fallback to METAR
    if (smhi.smhiData[props.id]?.timestamp) return smhi.smhiData[props.id].timestamp || ""
    return metar.time || ""
})

// Format timestamp: show only time (HH:MM) unless date differs from today
const formattedTime = computed(() => {
    if (!time.value) return ""
    const timeMoment = moment(time.value)
    const now = moment()
    
    // Check if date differs from today
    const isToday = timeMoment.isSame(now, 'day')
    
    if (isToday) {
        // Show only time: HH:MM
        return timeMoment.utc().format('HH:mm')
    } else {
        // Show date and time: YYYY-MM-DD HH:MM
        return timeMoment.utc().format('YYYY-MM-DD HH:mm')
    }
})

const parsedMetar = computed(() => metar.parse(props.id))
const smhiData = computed(() => smhi.smhiData[props.id])

// Get wind data for current runway pair
const currentRunwayWindData = computed(() => {
    if (!props.id || !windStore.windData[props.id] || !currentRunway.value) return null
    
    const windData = windStore.windData[props.id]
    const rwyParts = currentRunway.value.split("/")
    
    // Get runway data for both ends (match with full name including L/R/C)
    const leRwy = windData.runways.find(r => {
        // Match by full name first, then by numeric part
        return r.name === rwyParts[0] || r.name.replace(/[LRC]$/, "") === rwyParts[0].replace(/[LRC]$/, "")
    })
    const heRwy = windData.runways.find(r => {
        // Match by full name first, then by numeric part
        return r.name === rwyParts[1] || (rwyParts.length === 1 && r.name === rwyParts[0]) ||
               r.name.replace(/[LRC]$/, "") === (rwyParts[1] || rwyParts[0]).replace(/[LRC]$/, "")
    })
    
    if (!leRwy && !heRwy) return null
    
    return {
        le: leRwy || null,
        he: heRwy || null,
        // Fallback to general wind data if runway-specific not available
        general: {
            direction: windData.direction,
            speed: windData.speed,
            variableFrom: windData.variableFrom,
            variableTo: windData.variableTo,
            minWind: windData.minWind,
            maxWind: windData.maxWind,
            gust: windData.gust,
        },
    }
})

const metsensorText = computed(() => {
    // Get temperature and dewpoint from SMHI first, fallback to METAR
    let temperature: number | undefined = smhiData.value?.temperature
    let dewpoint: number | undefined = smhiData.value?.dewpoint
    let humidity: number | undefined = smhiData.value?.humidity
    
    // Fallback to METAR if SMHI data not available
    if (temperature === undefined && parsedMetar.value && typeof parsedMetar.value.temperature === "number") {
        temperature = parsedMetar.value.temperature
    }
    if (dewpoint === undefined && parsedMetar.value && typeof parsedMetar.value.dewPoint === "number") {
        dewpoint = parsedMetar.value.dewPoint
    }
    
    // Get QNH from SMHI, fallback to METAR if needed
    let qnh: number | undefined = smhiData.value?.qnh
    if (qnh === undefined && parsedMetar.value && parsedMetar.value.altimeter && parsedMetar.value.altimeter.value) {
        qnh = parsedMetar.value.altimeter.value
    }
    
    // Format temperature - always show one decimal (e.g., "15.0", "-5.0")
    let tempValue: string = ""
    if (typeof temperature === "number") {
        tempValue = temperature.toFixed(1)
        // Ensure consistent width with padding if needed
        if (temperature >= 0 && temperature < 10) {
            tempValue = " " + tempValue
        }
    }
    
    // Format dewpoint - always show one decimal (e.g., "15.0", "-5.0")
    let dewpointValue: string = ""
    if (typeof dewpoint === "number") {
        dewpointValue = dewpoint.toFixed(1)
        if (dewpoint >= 0 && dewpoint < 10) {
            dewpointValue = " " + dewpointValue
        }
    }
    
    // Calculate relative humidity if not from SMHI
    // Use Magnus formula: RH = 100 × [e^(17.625 × Dp/(243.04 + Dp)) / e^(17.625 × T/(243.04 + T))]
    // Reference: https://www.omnicalculator.com/physics/relative-humidity
    let calculatedHumidity: number | undefined = humidity
    if (calculatedHumidity === undefined && typeof temperature === "number" && typeof dewpoint === "number") {
        const T = temperature
        const Dp = dewpoint
        
        // Calculate using Magnus formula with revised coefficients (Alduchov and Eskridge)
        const beta = 17.625
        const lambda = 243.04
        
        const numerator = Math.exp((beta * Dp) / (lambda + Dp))
        const denominator = Math.exp((beta * T) / (lambda + T))
        calculatedHumidity = 100 * (numerator / denominator)
    }
    
    // Format humidity
    let humidityStr = ""
    if (typeof calculatedHumidity === "number") {
        humidityStr = Math.round(calculatedHumidity).toString()
    }
    
    // Format QNH - display as XXXX.X without spaces
    // Always show decimal if from SMHI, no leading zero
    let qnhValue = ""
    if (typeof qnh === "number") {
        // Check if QNH is from SMHI
        const isFromSmhi = smhiData.value?.qnh !== undefined
        if (isFromSmhi) {
            // Always show one decimal if from SMHI (e.g., "1013.0" or "1013.5")
            qnhValue = qnh.toFixed(1)
        } else {
            // Integer QNH from METAR fallback (no decimal, no leading zero)
            qnhValue = Math.round(qnh).toString()
        }
    }
    
    // Calculate QFE from QNH and airport elevation
    // QFE = QNH * (1 - elevation_m / 8434.5) where elevation_m = elevation_ft * 0.3048
    // Using ISA standard atmosphere formula
    let qfe: number | undefined = undefined
    if (typeof qnh === "number" && airportElevationFt.value > 0) {
        const elevationM = airportElevationFt.value * 0.3048 // Convert feet to meters
        // More accurate formula using ISA standard atmosphere
        qfe = qnh * (1 - elevationM / 8434.5)
    }
    
    // Format QFE - show decimal if from SMHI QNH, no decimal if integer QNH
    let qfeValue = ""
    if (typeof qfe === "number") {
        const isFromSmhi = smhiData.value?.qnh !== undefined
        if (isFromSmhi) {
            // Show one decimal if QNH was from SMHI
            qfeValue = qfe.toFixed(1)
        } else {
            // Integer if QNH was from METAR
            qfeValue = Math.round(qfe).toString()
        }
    }
    
    // Calculate TRL from QNH
    let trl: number | undefined = undefined
    if (typeof qnh === "number") {
        trl = calculateTrl(props.id, qnh)
    }
    
    // Format TRL
    const trlValue = trl !== undefined ? trl.toString() : "??"
    
    // Get wind data for the columns
    const windData = currentRunwayWindData.value
    const rwyParts = currentRunway.value.split("/")
    
    // Helper function to format three columns with consistent spacing (matching AWOS format)
    const formatThreeColumns = (label: string, col1: string, col2: string, col3: string) => {
        // Format: LABEL    COL1          COL2          COL3
        // Use consistent spacing (8-10 spaces) between columns
        return `${label.padEnd(10)}${col1.padEnd(12)}${col2.padEnd(12)}${col3}`
    }
    
    // RWY column: Show runway identifiers (three columns)
    // Middle column should have "M" for midpoint
    // Preserve L/R/C designators in runway display
    const rwyCol1 = rwyParts.length >= 2 ? rwyParts[0] : rwyParts.length === 1 ? rwyParts[0] : ""
    const rwyCol2 = "M" // Middle column with "M" for midpoint
    const rwyCol3 = rwyParts.length >= 2 ? rwyParts[1] : ""
    const rwyLine = formatThreeColumns("RWY", rwyCol1, rwyCol2, rwyCol3)
    
    // MEAN02 column: Wind direction/speed from METAR (like windrose)
    // Middle column should be empty for MEAN02
    let mean02Line = formatThreeColumns("MEAN02", "", "", "")
    if (windData) {
        const formatWind = (rwy: any, general: any) => {
            const dir = rwy?.direction ?? general?.direction
            const spd = rwy?.speed ?? general?.speed
            
            // Check for calm wind: when speed is 0 or missing, and direction is undefined/null/0/"CALM"
            // Also check if both speed and direction are missing/0
            const speedIsZero = spd === 0 || spd === undefined || spd === null
            const directionIsCalm = dir === undefined || dir === null || dir === 0 || dir === "CALM" || (typeof dir === "string" && dir.toUpperCase() === "CALM")
            const isCalm = speedIsZero && directionIsCalm
            
            if (isCalm) {
                return "000/00"
            }
            
            if (typeof dir === "number" && typeof spd === "number" && spd > 0) {
                return `${String(dir).padStart(3, "0")}/${String(spd).padStart(2, "0")}KT`
            }
            if (dir === "VRB" && typeof spd === "number" && spd > 0) {
                return `VRB${String(spd).padStart(2, "0")}KT`
            }
            return ""
        }
        const leWind = formatWind(windData.le, windData.general)
        const heWind = formatWind(windData.he, windData.general)
        mean02Line = formatThreeColumns("MEAN02", leWind, "", heWind)
    }
    
    // VRB column: Variable wind range from METAR
    let vrbLine = formatThreeColumns("VRB", "", "", "")
    if (windData) {
        const formatVrb = (rwy: any, general: any) => {
            const from = rwy?.variableFrom ?? general?.variableFrom
            const to = rwy?.variableTo ?? general?.variableTo
            if (typeof from === "number" && typeof to === "number") {
                return `${String(from).padStart(3, "0")}-${String(to).padStart(3, "0")}`
            }
            return ""
        }
        const leVrb = formatVrb(windData.le, windData.general)
        const heVrb = formatVrb(windData.he, windData.general)
        
        // For middle column, use general wind VRB, or use either runway's VRB if available
        let generalVrb = formatVrb(null, windData.general)
        if (!generalVrb) {
            // If no general VRB, try to use either runway's VRB for the middle column
            generalVrb = leVrb || heVrb || ""
        }
        
        vrbLine = formatThreeColumns("VRB", leVrb, generalVrb, heVrb)
    }
    
    // MIN/MAX column: Min/max wind speeds from METAR
    let minMaxLine = formatThreeColumns("MIN/MAX", "", "", "")
    if (windData) {
        const formatMinMax = (rwy: any, general: any) => {
            const min = rwy?.minWind ?? general?.minWind
            const max = rwy?.maxWind ?? general?.maxWind
            if (typeof min === "number" && typeof max === "number") {
                return `${String(min).padStart(2, "0")}/${String(max).padStart(2, "0")}`
            }
            return ""
        }
        const leMinMax = formatMinMax(windData.le, windData.general)
        const generalMinMax = formatMinMax(null, windData.general)
        const heMinMax = formatMinMax(windData.he, windData.general)
        minMaxLine = formatThreeColumns("MIN/MAX", leMinMax, generalMinMax, heMinMax)
    }
    
    // COMP column: Head/tailwind and crosswind component
    // Format: -08/R01 means 8 kt headwind and 1 kt crosswind from right
    let compLine = formatThreeColumns("COMP", "", "", "")
    if (windData) {
        const formatComp = (rwy: any) => {
            if (!rwy || rwy.headWind === undefined || rwy.crossWind === undefined) return ""
            const headWind = rwy.headWind
            const crossWind = rwy.crossWind
            const crossWindDir = rwy.crossWindDir || ""
            
            // Check for NaN values and treat as 0 (calm wind)
            const headWindValue = (typeof headWind === "number" && !isNaN(headWind)) ? headWind : 0
            const crossWindValue = (typeof crossWind === "number" && !isNaN(crossWind)) ? crossWind : 0
            
            // Format: headwind (negative = tailwind, positive = headwind), crosswind with direction
            const headStr = headWindValue >= 0 
                ? `+${String(Math.abs(headWindValue)).padStart(2, "0")}`
                : `-${String(Math.abs(headWindValue)).padStart(2, "0")}`
            const crossStr = crossWindValue > 0 ? `${crossWindDir}${String(crossWindValue).padStart(2, "0")}` : "00"
            return `${headStr}/${crossStr}`
        }
        const leComp = formatComp(windData.le)
        const heComp = formatComp(windData.he)
        compLine = formatThreeColumns("COMP", leComp, "", heComp)
    }
    
    // RVR column: Runway Visual Range from METAR - shown only for specific runway ends
    let rvrCol1 = "" // Left runway end
    let rvrCol2 = "" // Middle column (empty)
    let rvrCol3 = "" // Right runway end
    
    // Parse RVR from raw METAR string and map to specific runways
    if (metar.metar[props.id] && !metar.metar[props.id].includes("Loading")) {
        const rawMetar = metar.metar[props.id]
        // METAR RVR format: R{runway number}{designator}/{RVR value}[V{max}]?[NUD]
        // N=no change, U=upward trend, D=downward trend
        // Examples: R03/2000N, R26R/P2000N, R03/M0050N, R32/0550N, R33/0400U, R03/1200V2000N
        const rvrPattern = /R(\d{2}[LCR]?)\/([PM]?)(\d{4})(?:V(\d{4}))?[NUD]/g
        const matches = [...rawMetar.matchAll(rvrPattern)]
        
        // Get current runway numbers for matching (preserve L/R/C designators)
        const rwyParts = currentRunway.value.split("/")
        const rwy1Full = rwyParts[0] || ""
        const rwy2Full = rwyParts.length > 1 ? rwyParts[1] : ""
        // Get numeric parts for matching (METAR may not have L/R/C)
        const rwy1Num = rwy1Full ? rwy1Full.replace(/[LRC]$/, "").padStart(2, "0") : ""
        const rwy2Num = rwy2Full ? rwy2Full.replace(/[LRC]$/, "").padStart(2, "0") : ""
        
        // Process each RVR match
        for (const match of matches) {
            const rvrRwyFull = match[1] // Full runway identifier (e.g., "32", "26R", "03L")
            const rvrRwyNum = rvrRwyFull.replace(/[LRC]$/, "").padStart(2, "0") // Just the number
            const prefix = match[2] // P = plus (greater than), M = minus (less than)
            const value = parseInt(match[3])
            const rangeValue = match[4] ? parseInt(match[4]) : undefined
            
            // Format RVR value
            let formattedRvr: string
            if (prefix === "P" || value >= 2000 || (rangeValue && rangeValue >= 2000)) {
                formattedRvr = ">2000N"
            } else if (prefix === "M") {
                formattedRvr = `<${value}N`
            } else if (rangeValue) {
                // Range: show min/max (remove leading zeros)
                formattedRvr = `${value}V${rangeValue}N`
            } else {
                // Remove leading zeros from value (e.g., 0550 -> 550)
                formattedRvr = `${value}N`
            }
            
            // Assign to the correct column based on runway match
            if (rwy1Num && rvrRwyNum === rwy1Num) {
                rvrCol1 = formattedRvr
            } else if (rwy2Num && rvrRwyNum === rwy2Num) {
                rvrCol3 = formattedRvr
            }
        }
    }
    
    // If no RVR data found in METAR, show ">2000N" in both runway end columns
    let hasRvrData = false
    if (rvrCol1 || rvrCol3) {
        hasRvrData = true
    }
    
    if (!hasRvrData && metar.metar[props.id] && !metar.metar[props.id].includes("Loading")) {
        const rwyParts = currentRunway.value.split("/")
        if (rwyParts[0]) {
            rvrCol1 = ">2000N"
        }
        if (rwyParts.length > 1 && rwyParts[1]) {
            rvrCol3 = ">2000N"
        }
    }
    
    const rvrLine = formatThreeColumns("RVR", rvrCol1, rvrCol2, rvrCol3)
    
    // VIS column: Visibility from SMHI API - shown only in middle (M) column
    // Show in meters (M) when 5000 m or less, otherwise in kilometers (KM)
    let visLine = formatThreeColumns("VIS", "", "", "")
    const visibility = smhiData.value?.visibility
    if (typeof visibility === "number") {
        let visFormatted: string
        if (visibility <= 5000) {
            // Show in meters when 5000 m or less (with space before unit)
            visFormatted = `${visibility} M`
        } else {
            // Show in kilometers when more than 5 km (with space before unit)
            const visKm = Math.round(visibility / 1000)
            visFormatted = `${visKm} KM`
        }
        // Show visibility only in the middle column
        visLine = formatThreeColumns("VIS", "", visFormatted, "")
    }
    
    // PRW (Present Weather) row - parse from METAR
    let prwLine = formatThreeColumns("PRW", "", "", "")
    if (parsedMetar.value && parsedMetar.value.weatherConditions) {
        const weatherCodes = parsedMetar.value.weatherConditions.map((w: any) => {
            let code = ""
            if (w.intensity) code += w.intensity
            if (w.descriptor) code += w.descriptor
            if (w.phenomenons && Array.isArray(w.phenomenons)) {
                code += w.phenomenons.join("")
            }
            if (w.obscuration) code += w.obscuration
            if (w.other) code += w.other
            return code
        }).join(" ")
        
        if (weatherCodes) {
            // Show PRW in middle column
            prwLine = formatThreeColumns("PRW", "", weatherCodes, "")
        }
    }
    
    // CLD (Clouds) rows - always reserve 3 rows, fill with up to 3 cloud layers
    // Always show CLD column label, even if no cloud data
    const cldLines: string[] = []
    let cloudCount = 0
    
    if (parsedMetar.value && parsedMetar.value.clouds && parsedMetar.value.clouds.length > 0) {
        // Limit to maximum 3 cloud layers
        const cloudsToShow = parsedMetar.value.clouds.slice(0, 3)
        cloudsToShow.forEach((cloud: any, index: number) => {
            let part = ""
            // Format: quantity height FT (e.g., "OVC 900 FT")
            // Only show quantity (coverage) and height, not types
            if (cloud.quantity) part += cloud.quantity + " "
            if (cloud.height) {
                // Height is already in feet in parsed METAR, add space before FT
                part += `${cloud.height} FT`
            }
            // Trim any trailing space
            if (part) {
                const cloudStr = part.trim()
                // First row: "CLD", subsequent rows: "    " (indented)
                if (index === 0) {
                    cldLines.push(formatThreeColumns("CLD", "", cloudStr, ""))
                } else {
                    cldLines.push(formatThreeColumns("    ", "", cloudStr, ""))
                }
                cloudCount++
            }
        })
    }
    
    // Always show CLD label in first row, even if no cloud data was added
    if (cloudCount === 0) {
        cldLines.push(formatThreeColumns("CLD", "", "", ""))
    }
    
    // Always ensure exactly 3 rows - pad with empty rows if needed
    while (cldLines.length < 3) {
        // Subsequent rows: empty (indented like CLD2, CLD3)
        cldLines.push(formatThreeColumns("    ", "", "", ""))
    }
    
    // QFETHR row: QFE for runway threshold elevations (three columns)
    let qfethrLine = formatThreeColumns("QFETHR", "", "", "")
    if (qnh && currentRunwayThresholds.value && currentRunwayThresholds.value.leElevationFt > 0) {
        const calculateQfe = (elevationFt: number) => {
            const elevationM = elevationFt * 0.3048
            const qfe = qnh * (1 - elevationM / 8434.5)
            const isFromSmhi = smhiData.value?.qnh !== undefined
            return isFromSmhi ? qfe.toFixed(1) : Math.round(qfe).toString()
        }
        const leQfe = calculateQfe(currentRunwayThresholds.value.leElevationFt)
        const heQfe = currentRunwayThresholds.value.heElevationFt > 0
            ? calculateQfe(currentRunwayThresholds.value.heElevationFt)
            : ""
        qfethrLine = formatThreeColumns("QFETHR", leQfe, "", heQfe)
    }
    
    // Build the formatted text - columns above QNH, then QNH, then TRL/QFE row, then T/DP/HUM below
    // QNH line format: QNH <value> HPA
    const qnhLine = qnhValue ? `QNH ${qnhValue} HPA` : "QNH ??? HPA"
    
    // TRL/QFE line format: TRL  65       QFE  986.6
    const trlQfeLine = `TRL  ${trlValue.padEnd(9)}QFE   ${qfeValue || "??"}`
    
    // Format: T    <temp>  DP   <dewpoint>  HUM   <humidity>
    const tempLine = `T    ${tempValue.padEnd(8)} DP   ${dewpointValue.padEnd(7)} HUM   ${humidityStr}`
    
    // Join CLD lines (always exactly 3 rows)
    const cldSection = cldLines.join("\n")
    
    // Build the return string - always exactly 3 rows between PRW and QFETHR (used for CLD)
    const result = `${rwyLine}\n${mean02Line}\n${vrbLine}\n${minMaxLine}\n${compLine}\n\n${rvrLine}\n${visLine}\n${prwLine}\n${cldSection}\n${qfethrLine}\n${qnhLine}\n${trlQfeLine}\n${tempLine}`
    
    return result
})

const metsensorStylized = ref("")
const changed = ref(false)
const outdated = ref(false)
const noData = computed(() => {
    // Show component even if some data is missing (will show ?? for missing values)
    // Only show "NO DATA" if we have no data at all
    const hasAnyData = (smhiData.value && (smhiData.value.temperature !== undefined || smhiData.value.dewpoint !== undefined || smhiData.value.qnh !== undefined)) ||
                       (parsedMetar.value && parsedMetar.value.altimeter && parsedMetar.value.altimeter.value !== undefined)
    return !hasAnyData && (!metar.metar[props.id] || metar.metar[props.id].includes("Loading"))
})

function stylize(newValue: string, oldValue: string = "") {
    function padEndHtml(s: string, n: number) {
        const text = s.replace(/<[^>]+>/g, "")
        return text + " ".repeat(n - text.length)
    }

    if (!newValue) {
        metsensorStylized.value = ""
        return
    }
    
    const inLines = newValue.split(/\n/)
    const lastLines = oldValue.split(/\n/)
    const outLines = []
    
    for (let no = 0; no < inLines.length; no++) {
        let line = inLines[no]
        
        // Handle empty lines
        if (!line || line.trim() === "") {
            outLines.push("")
            continue
        }
        
        // Apply diff highlighting if we have old value (do this on plain text first)
        if (inLines.length == lastLines.length && oldValue) {
            const lastLine = lastLines[no] || ""
            // Extract plain text for comparison (strip any HTML that might exist)
            const plainLine = line.replace(/<[^>]+>/g, "")
            const plainLastLine = (lastLine || "").replace(/<[^>]+>/g, "")
            if (plainLastLine) {
                const diff = diffWords(plainLastLine.substring(5), plainLine.substring(5), {
                    ignoreCase: true,
                    ignoreWhitespace: true,
                })
                if (diff.some(part => part.added || part.removed)) {
                    line = plainLine.substring(0, 5)
                    for (const part of diff) {
                        if (part.removed) continue
                        if (part.added) line += `<span class="changed">${part.value}</span>`
                        else line += part.value
                    }
                }
            }
        }
        
        // Format columns above QNH (matching AWOS metsensor styling)
        if (line.startsWith("RWY") || line.startsWith(blue("RWY").substring(0, 4))) {
            // Extract plain text for parsing (strip HTML tags from diff highlighting)
            const plainText = line.replace(/<[^>]+>/g, "")
            
            // Format RWY line with blue "RWY", runway numbers, and "M" in middle column
            // Format: RWY (10 chars padded) + col1 runway num (12 chars padded) + col2 "M" (12 chars padded) + col3 runway num
            if (plainText.length >= 34) {
                const labelPart = plainText.substring(0, 10) // "RWY" + padding (10 chars)
                const col1Part = plainText.substring(10, 22) // First runway number (12 chars)
                const middleCol = plainText.substring(22, 34) // Middle column with "M" (12 chars)
                const col3Part = plainText.substring(34) // Second runway number
                
                // Replace "RWY" with blue "RWY" in the label
                const formattedLabel = labelPart.replace(/^RWY/, blue("RWY"))
                
                // Make runway numbers blue - replace the actual text while preserving padding
                const col1Trimmed = col1Part.trim()
                const col1Padding = col1Part.substring(col1Trimmed.length)
                const formattedCol1 = col1Trimmed ? blue(col1Trimmed) + col1Padding : col1Part
                
                // Replace "M" with blue "M" in the middle column, keeping padding
                const middleTrimmed = middleCol.trim()
                const middlePadding = middleCol.substring(middleTrimmed.length)
                const formattedMiddle = middleTrimmed === "M"
                    ? blue("M") + middlePadding
                    : middleCol
                
                // Make second runway number blue (no padding after it)
                const col3Trimmed = col3Part.trim()
                const formattedCol3 = col3Trimmed ? blue(col3Trimmed) : col3Part
                
                // If we had diff highlighting, we need to re-apply it to the formatted line
                // For now, just use the formatted version
                outLines.push(`${formattedLabel}${formattedCol1}${formattedMiddle}${formattedCol3}`)
            } else {
                // Fallback: just make RWY blue
                outLines.push(plainText.replace(/^RWY/, blue("RWY")))
            }
        } else if (line.match(/^(MEAN02|VRB|MIN\/MAX|COMP|VIS|PRW|CLD|QFETHR)/)) {
            // Handle CLD formatting like AWOS metsensor
            if (line.startsWith("CLD1")) {
                line = "CLD " + line.substring(4)
            } else if (line.startsWith("CLD2") || line.startsWith("CLD3")) {
                line = "    " + line.substring(4)
            }
            outLines.push(blueFirstWord(line))
        } else if (line.startsWith("RVR")) {
            // Apply RVR highlighting logic (same as AWOS metsensor)
            // Bold RVR values less than 2000
            // Match pattern like AWOS: RVR(\s+)(.+?)(\s\s+)(.+?)(\s\s+)(.+)
            const rvrMatch = line.match(/^RVR(\s+)(.+?)(\s\s+)(.+?)(\s\s+)(.*)$/)
            if (rvrMatch) {
                const [, spaces1, col1, spaces2, col2, spaces3, col3] = rvrMatch
                
                // Helper function to extract numeric value
                const getNumericValue = (value: string): number | null => {
                    if (!value || value.trim() === "") return null
                    // Check if it's ">2000N" - don't bold
                    if (value.includes(">2000")) return null
                    // Extract numeric value
                    const numMatch = value.match(/(\d+)/)
                    if (numMatch) {
                        return parseInt(numMatch[1])
                    }
                    return null
                }
                
                // Check if values should be bolded (< 2000)
                const val1 = getNumericValue(col1)
                const val2 = getNumericValue(col2)
                const val3 = getNumericValue(col3)
                
                // Bold values < 2000 - rebuild line with bold tags, matching AWOS format
                let formattedLine = `RVR${spaces1}`
                formattedLine += val1 !== null && val1 < 2000 ? `<b>${col1}</b>` : col1
                formattedLine += spaces2
                formattedLine += val2 !== null && val2 < 2000 ? `<b>${col2}</b>` : col2
                formattedLine += spaces3
                formattedLine += val3 !== null && val3 < 2000 ? `<b>${col3}</b>` : col3
                
                outLines.push(blueFirstWord(formattedLine))
            } else {
                outLines.push(blueFirstWord(line))
            }
        } else if (line.startsWith("QNH")) {
            // Format QNH line similar to AWOS format
            const m = line.match(/QNH(\s+.+?\s+)HPA(.*)/)
            if (m) {
                outLines.push(
                    `<hr class="my-2"/><div class="text-center">${blue("QNH")}<div class="leqnh">${m[1]}</div></div><hr class="mt-2" style="margin-bottom: -8px"/>`,
                )
            } else {
                outLines.push(line)
            }
        } else if (line.startsWith("TRL")) {
            // Format TRL/QFE line (between QNH and T/DP/HUM)
            // Match: TRL  <trl_value>       QFE   <qfe_value>
            const m = line.match(/TRL\s+(.+?)\s+QFE\s+(\S+)(.*)/)
            if (m) {
                // Preserve spacing to align QFE with DP below
                // "TRL  " (5) + trlValue (padded to 9) + "QFE   " (6)
                line = `${blue("TRL")}  ${padEndHtml(m[1], 9)}${blue("QFE")}   ${m[2]}${m[3] || ""}`
                outLines.push(line)
            } else {
                outLines.push(line)
            }
        } else if (line.startsWith("T") && line.includes("DP")) {
            // Format temperature and dewpoint line (below QNH)
            const m = line.match(/T\s+(.+?)\s+DP\s+(.+?)\s+HUM\s+(\S+)(.*)/)
            if (m) {
                // HUM value should not include % since we add it here
                const humValue = m[3].replace(/%/g, "")
                line = `${blue("T")}    ${padEndHtml(m[1], 8)} ${blue("DP")}   ${padEndHtml(m[2], 7)} ${blue("HUM")}   ${humValue}%${m[4] || ""}`
                outLines.push(line)
            } else {
                outLines.push(line)
            }
        } else {
            outLines.push(line)
        }
    }
    
    metsensorStylized.value = outLines.join("\n")
}

const blue = (text: string) => `<span style="color: #33f">${text}</span>`

const blueFirstWord = (text: string) => text.replace(/^(..\S+)/, blue("$1"))

let metarSubscription = ""
let smhiSubscription = ""
let changeTimeouts: any[] = []

function click() {
    for (const timeout of changeTimeouts) clearTimeout(timeout)
    changeTimeouts.splice(0)
    changed.value = false
}

let checkOutdatedInterval: any = undefined
let windSubscription = ""
onMounted(() => {
    stylize(metsensorText.value)
    metarSubscription = metar.subscribe(props.id)
    smhiSubscription = smhi.subscribe(props.id)
    // Subscribe to wind store to get runway data for runway selector
    windSubscription = windStore.subscribe(props.id)
    checkOutdatedInterval = setInterval(() => {
        // For SMHI data, mark as outdated only if more than 75 minutes old (since SMHI updates every 60 minutes)
        outdated.value = time.value.length > 0 && moment(time.value).isBefore(moment().subtract(75, "minutes"))
    }, 5000)
})

onUnmounted(() => {
    clearInterval(checkOutdatedInterval)
    if (metarSubscription) metar.unsubscribe(metarSubscription)
    if (smhiSubscription) smhi.unsubscribe(smhiSubscription)
    if (windSubscription) windStore.unsubscribe(windSubscription)
})

watch(metsensorText, (newValue: string, oldValue: string) => {
    stylize(newValue, oldValue)
    changed.value = false
    if (!settings.metsensorFlash) return
    changed.value = true
    changeTimeouts.splice(0)
    changeTimeouts.push(setTimeout(() => (changed.value = false), 1000))
    changeTimeouts.push(setTimeout(() => (changed.value = true), 2000))
    changeTimeouts.push(setTimeout(() => (changed.value = false), 3000))
})

watch(() => [parsedMetar.value, smhiData.value], () => {
    stylize(metsensorText.value)
})
</script>

