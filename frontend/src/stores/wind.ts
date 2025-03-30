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

// First clean up the CSV data to remove problematic double quotes
const cleanedCsv = runwaysRaw
    .replace(/""([^"]+)""/g, '$1') // Remove double quotes around values
    .replace(/"([^"]+)"/g, '$1');  // Remove single quotes

// Parse the cleaned CSV
const runwayData = Papa.parse(cleanedCsv, { 
    header: true,
    skipEmptyLines: true,
    delimiter: ',',
}).data
.map((row: any) => ({
    airport_ident: row.airport_ident?.trim(),
    le_ident: row.le_ident?.trim(),
    le_heading_degT: parseFloat(row.le_heading_degT) || 0,
    he_ident: row.he_ident?.trim(),
    he_heading_degT: parseFloat(row.he_heading_degT) || 0
}))
.filter(row => 
    row.airport_ident && 
    row.le_ident && 
    row.he_ident && 
    !isNaN(row.le_heading_degT) && 
    !isNaN(row.he_heading_degT)
);

// Debug logs
console.log('Cleaned CSV first line:', cleanedCsv.split('\n')[0]);
console.log('All parsed runways:', runwayData);

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
                    heading: r.le_heading_degT
                },
                he: {
                    name: r.he_ident,
                    heading: r.he_heading_degT
                }
            }));
        console.log(`[${icao}] Found runways:`, runways);
        return runways;
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
        console.log(`[${icao}] Calculated METAR wind data:`, windData);
        return windData;
    }

    function getWindFromWx(icao: string): WindData | undefined {
        const metsensor = wxStore.metsensor(icao)
        if (!metsensor) {
            console.log(`[${icao}] No metsensor data available`);
            return undefined;
        }

        const lines = metsensor.split('\n')
        
        // Get runway numbers from first line
        const rwyMatch = lines[0].match(/RWY\s+(\d{2})\s+.*?(\d{2})/)
        if (!rwyMatch) {
            console.log(`[${icao}] Could not parse runway numbers`);
            return undefined;
        }

        const [_, rwy1, rwy2] = rwyMatch
        console.log(`[${icao}] Processing data for runways ${rwy1} and ${rwy2}`);

        // Parse MEAN02 line for both runways
        const mean02Line = lines.find(line => line.startsWith('MEAN02'))
        if (!mean02Line) return undefined

        const mean02Match = mean02Line.match(/(\d{3})\/(\d+)\s*KT\s+.*?(\d{3})\/(\d+)\s*KT/)
        if (!mean02Match) return undefined

        const [__, rwy1Dir, rwy1Speed, rwy2Dir, rwy2Speed] = mean02Match
        
        // Parse VRB line for both runways
        const vrbLine = lines.find(line => line.startsWith('VRB'))
        const vrbMatch = vrbLine?.match(/(\d{3})-(\d{3})\s+.*?(\d{3})-(\d{3})/)
        
        // Parse MIN/MAX line for both runways
        const minMaxLine = lines.find(line => line.startsWith('MIN/MAX'))
        const minMaxMatch = minMaxLine?.match(/(\d+)\/(\d+)\s+.*?(\d+)\/(\d+)/)

        // Create a map of runway-specific data
        const rwyData = new Map([
            [rwy1, {
                direction: parseInt(rwy1Dir),
                speed: parseInt(rwy1Speed),
                variableFrom: vrbMatch ? parseInt(vrbMatch[1]) : undefined,
                variableTo: vrbMatch ? parseInt(vrbMatch[2]) : undefined,
                minWind: minMaxMatch ? parseInt(minMaxMatch[1]) : undefined,
                maxWind: minMaxMatch ? parseInt(minMaxMatch[2]) : undefined,
            }],
            [rwy2, {
                direction: parseInt(rwy2Dir),
                speed: parseInt(rwy2Speed),
                variableFrom: vrbMatch ? parseInt(vrbMatch[3]) : undefined,
                variableTo: vrbMatch ? parseInt(vrbMatch[4]) : undefined,
                minWind: minMaxMatch ? parseInt(minMaxMatch[3]) : undefined,
                maxWind: minMaxMatch ? parseInt(minMaxMatch[4]) : undefined,
            }]
        ]);

        console.log(`[${icao}] Parsed runway-specific data:`, Object.fromEntries(rwyData));

        const runways = getRunwaysForAirport(icao)
        
        return {
            // Use first runway's data as general airport wind
            direction: parseInt(rwy1Dir),
            speed: parseInt(rwy1Speed),
            unit: 'KT',
            variableFrom: vrbMatch ? parseInt(vrbMatch[1]) : undefined,
            variableTo: vrbMatch ? parseInt(vrbMatch[2]) : undefined,
            minWind: minMaxMatch ? parseInt(minMaxMatch[1]) : undefined,
            maxWind: minMaxMatch ? parseInt(minMaxMatch[2]) : undefined,
            runways: runways.flatMap(rwy => {
                // Get the runway number without letter suffix
                const leNum = rwy.le.name.replace(/[^0-9]/g, '')
                const heNum = rwy.he.name.replace(/[^0-9]/g, '')
                
                // Get specific wind data for each runway end
                const leData = rwyData.get(leNum)
                const heData = rwyData.get(heNum)

                return [
                    {
                        name: rwy.le.name,
                        heading: rwy.le.heading,
                        ...calculateWindComponents(
                            leData?.direction || parseInt(rwy1Dir),
                            leData?.speed || parseInt(rwy1Speed),
                            rwy.le.heading
                        )
                    },
                    {
                        name: rwy.he.name,
                        heading: rwy.he.heading,
                        ...calculateWindComponents(
                            heData?.direction || parseInt(rwy1Dir),
                            heData?.speed || parseInt(rwy1Speed),
                            rwy.he.heading
                        )
                    }
                ]
            })
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
        
        // Set up periodic wind updates
        const updateWind = () => {
            if (wxAirports.includes(icao)) {
                wxStore.subscribe(icao)
            }
            if (metarAirports.includes(icao)) {
                metarStore.subscribe(icao)
            }

            windData[icao] = getWind(icao) || { runways: [] }
        }

        // Initial update
        updateWind();

        // Set up interval for updates
        const interval = setInterval(updateWind, 15000);
        
        // Store interval for cleanup
        intervals[subscriptionId] = interval;

        return subscriptionId
    }

    // Update unsubscribe to clean up intervals
    const intervals = {} as { [key: string]: number }
    
    function unsubscribe(subscription: string) {
        if (subscription in subscriptions) {
            const icao = subscriptions[subscription]
            delete subscriptions[subscription]
            
            // Clear update interval
            if (intervals[subscription]) {
                clearInterval(intervals[subscription])
                delete intervals[subscription]
            }
            
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
        getRunwaysForAirport,
    }
}) 