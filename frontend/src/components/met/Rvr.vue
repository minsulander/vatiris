<template>
    <div class="rvr-container">
        <div v-if="noData" class="pa-3 text-center">NO DATA</div>
        <div v-else class="rvr-content">
            <!-- RVR display - table format -->
            <div class="rvr-display">
                <table class="rvr-table">
                    <tbody>
                        <template v-for="(rvrItem, index) in rvrDataList" :key="index">
                            <tr>
                                <td class="rvr-label">{{ rvrItem.label }}</td>
                                <td class="rvr-value">
                                    {{ rvrItem.formatted }}
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>
        </div>
        <!-- Timestamp -->
        <div
            v-if="formattedTime"
            :style="{ position: 'absolute', top: '0', right: timestampOffset, zIndex: 100 }"
            :class="['text-caption', 'font-weight-bold', outdated ? 'text-orange-darken-4' : '']"
        >
            {{ formattedTime }}
        </div>
        <!-- Runway selector - only show when more than one runway (more than 2 runway ends) -->
        <div v-if="showRunwaySelector" class="runway-selector" style="position: absolute; top: 0; right: 0; display: flex; gap: 0; pointer-events: auto; padding: 0; z-index: 101; margin: 0;">
            <template v-for="rwy in availableRunways" :key="rwy">
                <a
                    :title="`Select runway ${rwy}`"
                    class="font-weight-bold text-caption"
                    @click="selectedRunway = rwy"
                    :style="{ color: currentRunway === rwy ? '#444' : '#999', cursor: 'pointer', userSelect: 'none', textDecoration: 'none', padding: '0 4px' }"
                    >{{ rwy }}</a
                >
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from "vue"
import { useMetarStore } from "@/stores/metar"
import { useWxStore } from "@/stores/wx"
import { useWindStore } from "@/stores/wind"
import { wxAirports } from "@/metcommon"
import moment from "moment"

const props = defineProps<{ id: string }>()

const metar = useMetarStore()
const wx = useWxStore()
const windStore = useWindStore()

// Runway selection
const selectedRunway = ref("")

// Get available runways from wind store
const availableRunways = computed(() => {
    if (!props.id || !windStore.windData[props.id]) return []
    const runways = windStore.windData[props.id].runways
    
    // Group runway ends into pairs based on opposite headings
    const pairs: string[] = []
    const processed = new Set<string>()
    
    for (let i = 0; i < runways.length; i++) {
        const rwy1 = runways[i]
        if (processed.has(rwy1.name)) continue
        
        const rwy1Num = rwy1.name.replace(/[LRC]$/, "")
        const heading1 = rwy1.heading || 0
        
        // Find opposite runway
        let oppositeFound = false
        for (let j = i + 1; j < runways.length; j++) {
            const rwy2 = runways[j]
            if (processed.has(rwy2.name)) continue
            
            const heading2 = rwy2.heading || 0
            let diff = Math.abs(heading1 - heading2)
            if (diff > 180) diff = 360 - diff
            
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
        
        if (!oppositeFound && !processed.has(rwy1.name)) {
            pairs.push(rwy1.name)
            processed.add(rwy1.name)
        }
    }
    
    return pairs.sort((a, b) => {
        const aNum = parseInt(a.split("/")[0].replace(/[LRC]$/, ""))
        const bNum = parseInt(b.split("/")[0].replace(/[LRC]$/, ""))
        return aNum - bNum
    })
})

// Current runway - use selected or default
const currentRunway = computed(() => {
    if (selectedRunway.value) return selectedRunway.value
    const defaultRunway = windStore.getRunwayInUse(props.id)
    if (defaultRunway) {
        const defaultNum = defaultRunway.replace(/[LRC]$/, "")
        const pair = availableRunways.value.find(p => p.includes(defaultNum))
        if (pair) return pair
    }
    return availableRunways.value[0] || ""
})

// Show runway selector only if there are multiple runways
const showRunwaySelector = computed(() => {
    if (!props.id || !windStore.windData[props.id]) return false
    const runways = windStore.windData[props.id].runways
    return runways.length > 2
})

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

// Parse RVR from AWOS metsensor text
function parseRvrFromAwos(metsensorText: string, runway: string): { value: number | null; formatted: string; trend?: string } | null {
    if (!metsensorText) return null
    
    const lines = metsensorText.split("\n")
    const rvrLine = lines.find(line => line.startsWith("RVR"))
    if (!rvrLine) return null
    
    // Parse RVR line format: RVR    <col1>    <col2>    <col3>
    // Extract runway numbers from first line
    const rwyLine = lines.find(line => line.startsWith("RWY"))
    if (!rwyLine) return null
    
    // Match RWY line - could be "RWY 03 M 21" or similar format
    const rwyMatch = rwyLine.match(/RWY\s+(\d{2}[LCR]?)\s+.*?(\d{2}[LCR]?)/)
    if (!rwyMatch) return null
    
    const [_, rwy1, rwy2] = rwyMatch
    const rwyParts = runway.split("/")
    const rwy1Num = rwyParts[0] ? rwyParts[0].padStart(2, "0") : ""
    const rwy2Num = rwyParts.length > 1 ? rwyParts[1].padStart(2, "0") : ""
    
    // Match RVR line format - handle variable spacing
    // Format: RVR    <col1>    <col2>    <col3>
    const rvrMatch = rvrLine.match(/RVR(\s+)(.+?)(\s{2,})(.+?)(\s{2,})(.*)/)
    if (!rvrMatch) return null
    
    const [, , col1, , col2, , col3] = rvrMatch
    
    // Determine which column to use based on runway
    // AWOS format: col1 = first runway end, col2 = middle (usually empty), col3 = second runway end
    let rvrValue: string = ""
    const rwy1FromAwos = rwy1.replace(/[LRC]$/, "").padStart(2, "0")
    const rwy2FromAwos = rwy2.replace(/[LRC]$/, "").padStart(2, "0")
    
    if (rwy1Num && rwy1FromAwos === rwy1Num) {
        rvrValue = col1.trim()
    } else if (rwy2Num && rwy2FromAwos === rwy2Num) {
        rvrValue = col3.trim()
    } else {
        // Try to match by checking if runway number appears in either column
        if (rwy1Num && (col1.includes(rwy1Num) || col1.includes(rwy1Num.replace(/^0/, "")))) {
            rvrValue = col1.trim()
        } else if (rwy2Num && (col3.includes(rwy2Num) || col3.includes(rwy2Num.replace(/^0/, "")))) {
            rvrValue = col3.trim()
        } else {
            // Fallback: use first non-empty column
            rvrValue = col1.trim() || col3.trim() || col2.trim()
        }
    }
    
    if (!rvrValue || rvrValue === "") return null
    
    // Parse RVR value (e.g., ">2000N", "550N", "1200V2000N", "<500N")
    let value: number | null = null
    let formatted = rvrValue
    let trend: string | undefined = undefined
    
    if (rvrValue.includes(">2000") || rvrValue === ">2000N") {
        formatted = ">2000 m"
        value = 2000
    } else if (rvrValue.startsWith("<")) {
        const numMatch = rvrValue.match(/<(\d+)/)
        if (numMatch) {
            value = parseInt(numMatch[1])
            formatted = `<${value} m`
        }
    } else if (rvrValue.includes("V")) {
        // Range format: 1200V2000N
        const rangeMatch = rvrValue.match(/(\d+)V(\d+)/)
        if (rangeMatch) {
            const min = parseInt(rangeMatch[1])
            const max = parseInt(rangeMatch[2])
            value = min // Use minimum for comparison
            formatted = `${min}-${max} m`
        }
    } else {
        // Simple value: 550N or just 550
        const numMatch = rvrValue.match(/(\d+)/)
        if (numMatch) {
            value = parseInt(numMatch[1])
            formatted = `${value} m`
        }
    }
    
    return { value, formatted, trend }
}

// Parse RVR from METAR
function parseRvrFromMetar(metarText: string, runway: string): { value: number | null; formatted: string; trend?: string } | null {
    if (!metarText || metarText.includes("Loading")) return null
    
    const rwyParts = runway.split("/")
    const rwy1Num = rwyParts[0] ? rwyParts[0].padStart(2, "0") : ""
    const rwy2Num = rwyParts.length > 1 ? rwyParts[1].padStart(2, "0") : ""
    
    // METAR RVR format: R{runway number}{designator}/{RVR value}[V{max}]?[NUD]
    // N=no change, U=upward trend, D=downward trend
    const rvrPattern = /R(\d{2}[LCR]?)\/([PM]?)(\d{4})(?:V(\d{4}))?[NUD]/g
    const matches = [...metarText.matchAll(rvrPattern)]
    
    for (const match of matches) {
        const rvrRwyFull = match[1]
        const rvrRwyNum = rvrRwyFull.replace(/[LRC]$/, "").padStart(2, "0")
        const prefix = match[2]
        const value = parseInt(match[3])
        const rangeValue = match[4] ? parseInt(match[4]) : undefined
        
        // Check if this RVR matches our selected runway
        if (rwy1Num && rvrRwyNum === rwy1Num) {
            let formatted: string
            let rvrValue: number | null = null
            
            if (prefix === "P" || value >= 2000 || (rangeValue && rangeValue >= 2000)) {
                formatted = ">2000 m"
                rvrValue = 2000
            } else if (prefix === "M") {
                formatted = `<${value} m`
                rvrValue = value
            } else if (rangeValue) {
                formatted = `${value}-${rangeValue} m`
                rvrValue = value
            } else {
                formatted = `${value} m`
                rvrValue = value
            }
            
            return { value: rvrValue, formatted }
        } else if (rwy2Num && rvrRwyNum === rwy2Num) {
            let formatted: string
            let rvrValue: number | null = null
            
            if (prefix === "P" || value >= 2000 || (rangeValue && rangeValue >= 2000)) {
                formatted = ">2000 m"
                rvrValue = 2000
            } else if (prefix === "M") {
                formatted = `<${value} m`
                rvrValue = value
            } else if (rangeValue) {
                formatted = `${value}-${rangeValue} m`
                rvrValue = value
            } else {
                formatted = `${value} m`
                rvrValue = value
            }
            
            return { value: rvrValue, formatted }
        }
    }
    
    return null
}

// Get all RVR data for all runways - prefer AWOS, fallback to METAR
const rvrDataList = computed(() => {
    const items: Array<{ label: string; value: number | null; formatted: string; runway: string }> = []
    
    // Get all available runways - use selected or default runway
    const runways = availableRunways.value
    if (runways.length === 0) return items
    
    const selectedRunwayPair = currentRunway.value || runways[0]
    const rwyParts = selectedRunwayPair.split("/")
    
    let dataSource = ""
    
    // Try AWOS first (if available)
    const isWxAirport = wxAirports.includes(props.id)
    
    if (isWxAirport && wx.metsensor(props.id) && !wx.noData(props.id)) {
        dataSource = "AWOS"
        const metsensorText = wx.metsensor(props.id)
        const lines = metsensorText.split("\n")
        const rwyLine = lines.find(line => line.startsWith("RWY"))
        const rvrLine = lines.find(line => line.startsWith("RVR"))
        
        if (rwyLine && rvrLine) {
            // Parse AWOS format
            const rwyMatch = rwyLine.match(/RWY\s+(\d{2}[LCR]?)\s+.*?(\d{2}[LCR]?)/)
            const rvrMatch = rvrLine.match(/RVR(\s+)(.+?)(\s{2,})(.+?)(\s{2,})(.*)/)
            
            if (rwyMatch && rvrMatch) {
                const [, rwy1, rwy2] = rwyMatch
                const [, , col1, , col2, , col3] = rvrMatch
                
                // Parse RVR values and check which have actual data
                const rvr1 = parseRvrValue(col1.trim())
                const rvrMid = rwy2 ? parseRvrValue(col2.trim()) : { value: null, formatted: "", hasData: false }
                const rvr2 = rwy2 ? parseRvrValue(col3.trim()) : { value: null, formatted: "", hasData: false }
                
                // Count how many rows have actual data
                const dataCount = [rvr1.hasData, rvrMid.hasData, rvr2.hasData].filter(Boolean).length
                
                // Always show all three rows if we have a runway pair
                // First runway end - preserve L/R/C designator
                items.push({ 
                    label: `RVR ${rwy1}`, 
                    value: rvr1.hasData || dataCount === 0 ? rvr1.value : null, 
                    formatted: rvr1.hasData || dataCount === 0 ? rvr1.formatted : "", 
                    runway: rwy1 
                })
                
                // Middle (always show if we have two runway ends)
                if (rwy2) {
                    items.push({ 
                        label: "RVR MID", 
                        value: rvrMid.hasData || dataCount === 0 ? rvrMid.value : null, 
                        formatted: rvrMid.hasData || dataCount === 0 ? rvrMid.formatted : "", 
                        runway: "MID" 
                    })
                }
                
                // Second runway end - preserve L/R/C designator
                if (rwy2) {
                    items.push({ 
                        label: `RVR ${rwy2}`, 
                        value: rvr2.hasData || dataCount === 0 ? rvr2.value : null, 
                        formatted: rvr2.hasData || dataCount === 0 ? rvr2.formatted : "", 
                        runway: rwy2 
                    })
                }
            }
        }
    }
    
    // If no AWOS data or incomplete, try METAR
    if (items.length === 0 && metar.metar[props.id] && !metar.metar[props.id].includes("Loading")) {
        dataSource = "METAR"
        const metarText = metar.metar[props.id]
        
        // Parse all RVR values from METAR
        // Format: R{runway}/{value}[V{max}]?[NUD] where N=no change, U=upward, D=downward
        const rvrPattern = /R(\d{2}[LCR]?)\/([PM]?)(\d{4})(?:V(\d{4}))?[NUD]/g
        const matches = [...metarText.matchAll(rvrPattern)]
        
        // Create a map of runway -> RVR
        const rvrMap = new Map<string, { value: number | null; formatted: string }>()
        
        for (const match of matches) {
            const rvrRwyFull = match[1]
            const rvrRwyNum = rvrRwyFull.replace(/[LRC]$/, "").padStart(2, "0") // Pad to ensure consistent matching
            const prefix = match[2]
            const value = parseInt(match[3])
            const rangeValue = match[4] ? parseInt(match[4]) : undefined
            
            let formatted: string
            let rvrValue: number | null = null
            
            if (prefix === "P" || value >= 2000 || (rangeValue && rangeValue >= 2000)) {
                formatted = ">2000"
                rvrValue = 2000
            } else if (prefix === "M") {
                formatted = `<${value}`
                rvrValue = value
            } else if (rangeValue) {
                formatted = `${value}-${rangeValue}`
                rvrValue = value
            } else {
                // If value is 2000 or greater, show as >2000
                if (value >= 2000) {
                    formatted = ">2000"
                    rvrValue = 2000
                } else {
                    formatted = `${value}`
                    rvrValue = value
                }
            }
            
            rvrMap.set(rvrRwyNum, { value: rvrValue, formatted })
        }
        
        // Always show all rows for runway pair
        // Preserve full runway names with L/R/C designators
        const rwy1Full = rwyParts[0] || ""
        const rwy2Full = rwyParts.length > 1 ? rwyParts[1] : ""
        // Get numeric part for RVR matching (METAR may not have L/R/C)
        const rwy1Num = rwy1Full ? rwy1Full.replace(/[LRC]$/, "").padStart(2, "0") : ""
        const rwy2Num = rwy2Full ? rwy2Full.replace(/[LRC]$/, "").padStart(2, "0") : ""
        
        // Check which runways have actual RVR data
        const hasRwy1Rvr = rwy1Num && rvrMap.has(rwy1Num)
        const hasRwy2Rvr = rwy2Num && rvrMap.has(rwy2Num)
        const dataCount = [hasRwy1Rvr, hasRwy2Rvr].filter(Boolean).length
        
        // Build items for primary runway pair - always show all three rows
        if (rwyParts[0]) {
            const rvr = rvrMap.get(rwy1Num)
            items.push({ 
                label: `RVR ${rwy1Full}`, 
                value: rvr ? rvr.value : (dataCount === 0 ? 2000 : null), 
                formatted: rvr ? rvr.formatted : (dataCount === 0 ? ">2000" : ""), 
                runway: rwy1Full 
            })
        }
        
        // Middle (always show if we have two runway ends)
        if (rwyParts.length > 1) {
            items.push({ 
                label: "RVR MID", 
                value: dataCount === 0 ? 2000 : null, 
                formatted: dataCount === 0 ? ">2000" : "", 
                runway: "MID" 
            })
        }
        
        // Second runway end
        if (rwyParts.length > 1 && rwyParts[1]) {
            const rvr = rvrMap.get(rwy2Num)
            items.push({ 
                label: `RVR ${rwy2Full}`, 
                value: rvr ? rvr.value : (dataCount === 0 ? 2000 : null), 
                formatted: rvr ? rvr.formatted : (dataCount === 0 ? ">2000" : ""), 
                runway: rwy2Full 
            })
        }
    }
    
    // If still no data, show defaults
    if (items.length === 0) {
        dataSource = "Default"
        if (rwyParts[0]) {
            // Preserve L/R/C designator in label
            items.push({ label: `RVR ${rwyParts[0]}`, value: 2000, formatted: ">2000", runway: rwyParts[0] })
        }
        if (rwyParts.length > 1) {
            items.push({ label: "RVR MID", value: 2000, formatted: ">2000", runway: "MID" })
            if (rwyParts[1]) {
                // Preserve L/R/C designator in label
                items.push({ label: `RVR ${rwyParts[1]}`, value: 2000, formatted: ">2000", runway: rwyParts[1] })
            }
        }
    }
    
    // Store data source for display
    ;(rvrDataList as any).source = dataSource
    
    return items
})

// Helper to parse RVR value string
function parseRvrValue(rvrValue: string): { value: number | null; formatted: string; hasData: boolean } {
    if (!rvrValue || rvrValue === "") {
        return { value: null, formatted: "", hasData: false }
    }
    
    // Check if it's ">2000" or "P2000" (plus/greater than)
    if (rvrValue.includes(">2000") || rvrValue === ">2000N" || rvrValue.startsWith("P") && rvrValue.includes("2000")) {
        return { value: 2000, formatted: ">2000", hasData: true }
    } else if (rvrValue.startsWith("<")) {
        const numMatch = rvrValue.match(/<(\d+)/)
        if (numMatch) {
            const value = parseInt(numMatch[1])
            return { value, formatted: `<${value}`, hasData: true }
        }
    } else if (rvrValue.includes("V")) {
        const rangeMatch = rvrValue.match(/(\d+)V(\d+)/)
        if (rangeMatch) {
            const min = parseInt(rangeMatch[1])
            const max = parseInt(rangeMatch[2])
            return { value: min, formatted: `${min}-${max}`, hasData: true }
        }
    } else {
        const numMatch = rvrValue.match(/(\d+)/)
        if (numMatch) {
            const value = parseInt(numMatch[1])
            // If value is 2000 or greater, show as >2000
            if (value >= 2000) {
                return { value: 2000, formatted: ">2000", hasData: true }
            }
            return { value, formatted: `${value}`, hasData: true }
        }
    }
    
    return { value: null, formatted: "", hasData: false }
}

const dataSource = computed(() => {
    return (rvrDataList as any).source || ""
})

// Get parsed METAR for timestamp extraction
const parsedMetar = computed(() => metar.parse(props.id))

// Time and outdated
const time = computed(() => {
    // Prefer AWOS time
    if (wx.time(props.id)) return wx.time(props.id)
    
    // Extract timestamp from parsed METAR if available
    if (parsedMetar.value && parsedMetar.value.day !== undefined && parsedMetar.value.hour !== undefined && parsedMetar.value.minute !== undefined) {
        const now = moment().utc()
        const metarDay = parsedMetar.value.day
        const metarHour = parsedMetar.value.hour
        const metarMinute = parsedMetar.value.minute || 0
        
        // Construct timestamp: use current month/year, adjust if day is in future (previous month)
        let metarDate = moment().utc()
            .date(metarDay)
            .hour(metarHour)
            .minute(metarMinute)
            .second(0)
            .millisecond(0)
        
        // If the METAR day is more than 2 days in the future, it's from the previous month
        if (metarDate.isAfter(now.clone().add(2, 'days'))) {
            metarDate.subtract(1, 'month')
        }
        
        return metarDate.toISOString()
    }
    
    // Fallback to global METAR time
    return metar.time || ""
})

// Format timestamp: show only time (HH:MMZ) unless date differs from today
const formattedTime = computed(() => {
    if (!time.value) return ""
    const timeMoment = moment(time.value)
    const now = moment()
    
    // Check if date differs from today
    const isToday = timeMoment.isSame(now, 'day')
    
    if (isToday) {
        // Show only time: HH:MMZ
        return timeMoment.utc().format('HH:mm[Z]')
    } else {
        // Show date and time: YYMMDD HH:MMZ
        return timeMoment.utc().format('YYMMDD HH:mm[Z]')
    }
})

const outdated = ref(false)

const noData = computed(() => {
    // Show component even if some data is missing
    const isWxAirport = wxAirports.includes(props.id)
    const hasAwos = isWxAirport && wx.metsensor(props.id) && !wx.noData(props.id)
    const hasMetar = metar.metar[props.id] && !metar.metar[props.id].includes("Loading")
    return !hasAwos && !hasMetar
})

let metarSubscription = ""
let wxSubscription = ""
let windSubscription = ""
let checkOutdatedInterval: any = undefined

onMounted(() => {
    metarSubscription = metar.subscribe(props.id)
    windSubscription = windStore.subscribe(props.id)
    
    // Subscribe to wx only if it's a wx airport
    if (wxAirports.includes(props.id)) {
        wxSubscription = wx.subscribe(props.id)
    }
    
    checkOutdatedInterval = setInterval(() => {
        outdated.value = time.value.length > 0 && moment(time.value).isBefore(moment().subtract(10, "minutes"))
    }, 5000)
})

onUnmounted(() => {
    clearInterval(checkOutdatedInterval)
    if (metarSubscription) metar.unsubscribe(metarSubscription)
    if (wxSubscription) wx.unsubscribe(wxSubscription)
    if (windSubscription) windStore.unsubscribe(windSubscription)
})
</script>

<style scoped>
.rvr-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0;
    overflow: hidden;
    position: relative;
}

.rvr-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 5px;
    position: relative;
}

.rvr-display {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    flex: 1;
    min-height: 0;
}

.rvr-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 auto;
    max-width: 250px;
}

.rvr-table tr {
    border: none;
}

.rvr-table tr:hover {
    background-color: transparent;
}

.rvr-table td {
    padding: 2px 6px;
    text-align: left;
    border: none;
}

.rvr-label {
    font-size: 16px;
    font-weight: 500;
    color: #666;
    white-space: nowrap;
}

.rvr-value {
    font-size: 20px;
    font-weight: bold;
    color: #333;
    font-family: monospace;
    white-space: nowrap;
    text-align: right;
}

.rvr-value.text-error {
    color: #d32f2f;
}

.runway-selector a {
    cursor: pointer;
    user-select: none;
    text-decoration: none;
}
</style>

