import { defineStore } from "pinia"
import { reactive } from "vue"
import { v4 as uuid } from "uuid"
import { useWxStore } from "./wx"
import { useMetarStore } from "./metar"
import { wxAirports, metarAirports } from "@/metcommon"
import Papa from 'papaparse'

export interface RunwayWindData {
    name: string
    heading: number
    headWind?: number
    crossWind?: number
    crossWindDir?: 'L' | 'R'
}

export interface WindData {
    direction?: number | string  // Can be numeric degrees or variable "VRB"
    speed?: number              // Speed value
    unit?: string
    gust?: number              // Gust value if present
    variableFrom?: number      // Variable wind direction range start
    variableTo?: number        // Variable wind direction range end
    minWind?: number
    maxWind?: number
    runways: RunwayWindData[]
}

// At the top of the file, after imports:
console.log('Raw runway data:', runwaysRaw.slice(0, 500)) // Show first 500 chars

// Import runway data as string
import runwaysRaw from "@/data/runways.csv?raw"

const runwayData = Papa.parse(runwaysRaw, { 
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.replace(/"/g, ''), // Remove quotes
}).data
.map((row: any) => ({
    airport_ident: row.airport_ident,
    le_ident: row.le_ident,
    le_heading_degT: parseFloat(row.le_heading_degT) || 0,
    he_ident: row.he_ident,
    he_heading_degT: parseFloat(row.he_heading_degT) || 0
}))
.filter(row => row.airport_ident && row.le_ident && row.he_ident); // Ensure we have valid data

// Add a debug log
console.log('First parsed runway:', runwayData[0]);

export const useWindStore = defineStore("wind", () => {
    const wxStore = useWxStore()
    const metarStore = useMetarStore()

    const subscriptions = reactive({} as { [key: string]: string })
    const windData = reactive({} as { [key: string]: WindData })

    function getRunwaysForAirport(icao: string) {
        const runways = runwayData
            .filter(r => r.airport_ident === icao)
            .map(r => ({
                le: {
                    name: r.le_ident,
                    heading: parseFloat(r.le_heading_degT) || 0
                },
                he: {
                    name: r.he_ident,
                    heading: parseFloat(r.he_heading_degT) || 0
                }
            }))
        return runways
    }

    function calculateWindComponents(windDirection: number, windSpeed: number, runwayHeading: number) {
        const angle = Math.abs(windDirection - runwayHeading)
        const headWind = Math.round(windSpeed * Math.cos(angle * Math.PI / 180))
        const crossWind = Math.round(windSpeed * Math.sin(angle * Math.PI / 180))
        const crossWindDir = ((windDirection - runwayHeading + 360) % 360 > 180) ? 'L' : 'R'
        return { headWind, crossWind, crossWindDir }
    }

    function getWindFromMetar(icao: string): WindData | undefined {
        const parsed = metarStore.parse(icao)
        if (!parsed?.wind) return undefined

        const runways = getRunwaysForAirport(icao)
        console.log('Runways for airport:', icao, runways);

        const windDir = typeof parsed.wind.degrees === 'number' ? parsed.wind.degrees : 0
        const windSpeed = parsed.wind.speed || 0

        const windData = {
            direction: parsed.wind.degrees || parsed.wind.direction,
            speed: windSpeed,
            unit: parsed.wind.unit,
            gust: parsed.wind.gust,
            variableFrom: parsed.wind.minVariation,
            variableTo: parsed.wind.maxVariation,
            runways: runways.flatMap(rwy => [
                {
                    name: rwy.le.name,
                    heading: rwy.le.heading,
                    ...calculateWindComponents(windDir, windSpeed, rwy.le.heading)
                },
                {
                    name: rwy.he.name,
                    heading: rwy.he.heading,
                    ...calculateWindComponents(windDir, windSpeed, rwy.he.heading)
                }
            ])
        };
        console.log('Wind data with runways:', windData);
        return windData;
    }

    function getWindFromWx(icao: string): WindData | undefined {
        const metsensor = wxStore.metsensor(icao)
        if (!metsensor) return undefined

        const lines = metsensor.split('\n')
        
        // Parse MEAN02 line for wind direction and speed
        const mean02Match = metsensor.match(/MEAN02\s+(\d{3})\/(\d+)\s*KT/)
        if (!mean02Match) return undefined

        const windDir = parseInt(mean02Match[1])
        const windSpeed = parseInt(mean02Match[2])
        
        // Parse VRB for variable wind range
        const vrbMatch = metsensor.match(/VRB\s+(\d{3})-(\d{3})/)
        
        // Parse MIN/MAX wind speeds
        const minMaxMatch = metsensor.match(/MIN\/MAX\s+(\d+)\/(\d+)/)

        const runways = getRunwaysForAirport(icao)
        
        return {
            direction: windDir,
            speed: windSpeed,
            unit: 'KT',
            variableFrom: vrbMatch ? parseInt(vrbMatch[1]) : undefined,
            variableTo: vrbMatch ? parseInt(vrbMatch[2]) : undefined,
            minWind: minMaxMatch ? parseInt(minMaxMatch[1]) : undefined,
            maxWind: minMaxMatch ? parseInt(minMaxMatch[2]) : undefined,
            runways: runways.flatMap(rwy => [
                {
                    name: rwy.le.name,
                    heading: rwy.le.heading,
                    ...calculateWindComponents(windDir, windSpeed, rwy.le.heading)
                },
                {
                    name: rwy.he.name,
                    heading: rwy.he.heading,
                    ...calculateWindComponents(windDir, windSpeed, rwy.he.heading)
                }
            ])
        }
    }

    function getWind(icao: string): WindData | undefined {
        if (wxAirports.includes(icao)) {
            const wxWind = getWindFromWx(icao)
            if (wxWind) return wxWind
        }
        
        if (metarAirports.includes(icao)) {
            return getWindFromMetar(icao)
        }

        return undefined
    }

    function subscribe(icao: string) {
        const subscriptionId = uuid()
        subscriptions[subscriptionId] = icao
        
        if (wxAirports.includes(icao)) {
            wxStore.subscribe(icao)
        }
        if (metarAirports.includes(icao)) {
            metarStore.subscribe(icao)
        }

        windData[icao] = getWind(icao) || { runways: [] }

        return subscriptionId
    }

    function unsubscribe(subscription: string) {
        if (subscription in subscriptions) {
            const icao = subscriptions[subscription]
            delete subscriptions[subscription]
            
            if (!Object.values(subscriptions).includes(icao)) {
                delete windData[icao]
                
                if (wxAirports.includes(icao)) {
                    wxStore.unsubscribe(icao)
                }
                if (metarAirports.includes(icao)) {
                    metarStore.unsubscribe(icao)
                }
            }
        }
    }

    return {
        windData,
        getWind,
        subscribe,
        unsubscribe,
    }
}) 