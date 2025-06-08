import { defineStore } from "pinia"
import { reactive, watch } from "vue"
import { v4 as uuid } from "uuid"
import { useWxStore } from "./wx"
import { useMetarStore } from "./metar"
import { wxAirports, metarAirports } from "@/metcommon"
import Papa from "papaparse"

export interface RunwayWindData {
    name: string
    heading: number
    direction?: number | string // Can be numeric degrees or variable "VRB"
    speed?: number // Speed value
    gust?: number // Gust value if present
    variableFrom?: number // Variable wind direction range start
    variableTo?: number // Variable wind direction range end
    minWind?: number
    maxWind?: number
    headWind?: number
    crossWind?: number
    crossWindDir?: string
}

export interface WindData {
    direction?: number | string // Can be numeric degrees or variable "VRB"
    speed?: number // Speed value
    unit?: string
    gust?: number // Gust value if present
    variableFrom?: number // Variable wind direction range start
    variableTo?: number // Variable wind direction range end
    minWind?: number
    maxWind?: number
    runways: RunwayWindData[]
    timestamp?: string
}

// Import runway data as string
import runwaysRaw from "@/data/runways.csv?raw"

import geomagnetism from "geomagnetism"
import { timestamp } from "@vueuse/core"
import { useVatsimStore } from "./vatsim"
const geomag = geomagnetism.model()

// First clean up the CSV data to remove problematic double quotes
const cleanedCsv = runwaysRaw
    .replace(/""([^"]+)""/g, "$1") // Remove double quotes around values
    .replace(/"([^"]+)"/g, "$1") // Remove single quotes

// Parse the cleaned CSV
const runwayData = Papa.parse(cleanedCsv, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
})
    .data.map((row: any) => {
        const leGeo = geomag.point([
            parseFloat(row.le_latitude_deg),
            parseFloat(row.le_longitude_deg),
        ])
        const heGeo = geomag.point([
            parseFloat(row.he_latitude_deg),
            parseFloat(row.he_longitude_deg),
        ])
        return {
            airport_ident: row.airport_ident?.trim(),
            le_ident: row.le_ident?.trim(),
            le_heading_deg: parseFloat(row.le_heading_degT) - (leGeo ? leGeo.decl : 0),
            he_ident: row.he_ident?.trim(),
            he_heading_deg: parseFloat(row.he_heading_degT) - (heGeo ? heGeo.decl : 0),
        }
    })
    .filter(
        (row) =>
            row.airport_ident &&
            row.le_ident &&
            row.he_ident &&
            !isNaN(row.le_heading_deg) &&
            !isNaN(row.he_heading_deg),
    )

export const useWindStore = defineStore("wind", () => {
    const wxStore = useWxStore()
    const metarStore = useMetarStore()
    const vatsimStore = useVatsimStore()

    const subscriptions = reactive({} as { [key: string]: string })
    const windData = reactive({} as { [key: string]: WindData })

    function getRunwaysForAirport(icao: string) {
        const runways = runwayData
            .filter((r) => r.airport_ident === icao)
            .map((r) => ({
                le: {
                    name: r.le_ident,
                    heading: r.le_heading_deg,
                },
                he: {
                    name: r.he_ident,
                    heading: r.he_heading_deg,
                },
            }))
        return runways
    }

    function calculateWindComponents(
        windDirection: number | string | undefined,
        windSpeed: number,
        runwayHeading: number,
    ) {
        if (windDirection === undefined || windSpeed === undefined)
            return { headWind: 0, crossWind: 0, crossWindDir: "VRB" }
        if (windDirection === "VRB") return { headWind: 0, crossWind: 0, crossWindDir: "VRB" }
        if (typeof windDirection === "string") windDirection = parseInt(windDirection)
        const angle = Math.abs(windDirection - runwayHeading)
        const headWind = Math.round(windSpeed * Math.cos((angle * Math.PI) / 180))
        const crossWind = Math.abs(Math.round(windSpeed * Math.sin((angle * Math.PI) / 180)))
        const crossWindDir = (windDirection - runwayHeading + 360) % 360 > 180 ? "L" : "R"
        return { headWind, crossWind, crossWindDir }
    }

    function getWindFromMetar(icao: string): WindData | undefined {
        const parsed = metarStore.parse(icao)
        if (!parsed || !parsed.wind) return undefined

        const runways = getRunwaysForAirport(icao)

        const windData = {
            direction: parsed.wind.degrees || parsed.wind.direction,
            speed: parsed.wind.speed,
            unit: parsed.wind.unit,
            gust: parsed.wind.gust,
            variableFrom: parsed.wind.minVariation,
            variableTo: parsed.wind.maxVariation,
            runways: runways.flatMap((rwy) => [
                {
                    name: rwy.le.name,
                    heading: rwy.le.heading,
                    direction: parsed.wind?.degrees || parsed.wind?.direction,
                    speed: parsed.wind?.speed,
                    gust: parsed.wind?.gust,
                    variableFrom: parsed.wind?.minVariation,
                    variableTo: parsed.wind?.maxVariation,
                    ...calculateWindComponents(
                        parsed.wind?.degrees || parsed.wind?.direction,
                        parsed.wind?.speed || 0,
                        rwy.le.heading,
                    ),
                },
                {
                    name: rwy.he.name,
                    heading: rwy.he.heading,
                    direction: parsed.wind?.degrees || parsed.wind?.direction,
                    speed: parsed.wind?.speed,
                    gust: parsed.wind?.gust,
                    variableFrom: parsed.wind?.minVariation,
                    variableTo: parsed.wind?.maxVariation,
                    ...calculateWindComponents(
                        parsed.wind?.degrees || parsed.wind?.direction,
                        parsed.wind?.speed || 0,
                        rwy.he.heading,
                    ),
                },
            ]),
            timestamp: metarStore.time,
        }
        return windData
    }

    function getWindFromWx(icao: string): WindData | undefined {
        const metsensor = wxStore.metsensor(icao)
        if (!metsensor) return undefined
        const lines = metsensor.split("\n")

        // Get runway numbers from first line
        const rwyMatch = lines[0].match(/RWY\s+(\d{2}[LRC]?)\s+.*?(\d{2}[LRC]?)/)
        if (!rwyMatch) return undefined

        const [_, rwy1, rwy2] = rwyMatch

        // Parse MEAN02 line for both runways
        const mean02Line = lines.find((line) => line.startsWith("MEAN02"))
        if (!mean02Line) return undefined

        const mean02Match = mean02Line.match(/(\d{3})\/(\d+)\s*KT\s+.*?(\d{3})\/(\d+)\s*KT/)
        if (!mean02Match) return undefined

        const [__, rwy1Dir, rwy1Speed, rwy2Dir, rwy2Speed] = mean02Match

        // Parse VRB line for both runways
        const vrbLine = lines.find((line) => line.startsWith("VRB"))
        const vrbMatch = vrbLine?.match(/(\d{3})-(\d{3})\s+.*?(\d{3})-(\d{3})/)

        // Parse MIN/MAX line for both runways
        const minMaxLine = lines.find((line) => line.startsWith("MIN/MAX"))
        const minMaxMatch = minMaxLine?.match(/(\d+)\/(\d+)\s+.*?(\d+)\/(\d+)/)

        // Create a map of runway-specific data
        const rwyData = new Map([
            [
                rwy1,
                {
                    direction: parseInt(rwy1Dir),
                    speed: parseInt(rwy1Speed),
                    variableFrom: vrbMatch ? parseInt(vrbMatch[1]) : undefined,
                    variableTo: vrbMatch ? parseInt(vrbMatch[2]) : undefined,
                    minWind: minMaxMatch ? parseInt(minMaxMatch[1]) : undefined,
                    maxWind: minMaxMatch ? parseInt(minMaxMatch[2]) : undefined,
                },
            ],
            [
                rwy2,
                {
                    direction: parseInt(rwy2Dir),
                    speed: parseInt(rwy2Speed),
                    variableFrom: vrbMatch ? parseInt(vrbMatch[3]) : undefined,
                    variableTo: vrbMatch ? parseInt(vrbMatch[4]) : undefined,
                    minWind: minMaxMatch ? parseInt(minMaxMatch[3]) : undefined,
                    maxWind: minMaxMatch ? parseInt(minMaxMatch[4]) : undefined,
                },
            ],
        ])

        const runways = getRunwaysForAirport(icao)

        const dir1r = (parseInt(rwy1Dir) * Math.PI) / 180
        const dir2r = (parseInt(rwy2Dir) * Math.PI) / 180
        let averageDirection =
            Math.round(
                (Math.atan2(Math.sin(dir1r) + Math.sin(dir2r), Math.cos(dir1r) + Math.cos(dir2r)) *
                    180) /
                    Math.PI /
                    10,
            ) * 10
        if (averageDirection <= 0) averageDirection += 360

        return {
            direction: averageDirection,
            speed: Math.round((parseInt(rwy1Speed) + parseInt(rwy2Speed)) / 2),
            unit: "KT",
            variableFrom: vrbMatch
                ? Math.min(parseInt(vrbMatch[1]), parseInt(vrbMatch[3]))
                : undefined,
            variableTo: vrbMatch
                ? Math.max(parseInt(vrbMatch[2]), parseInt(vrbMatch[4]))
                : undefined,
            minWind: minMaxMatch
                ? Math.min(parseInt(minMaxMatch[1]), parseInt(minMaxMatch[3]))
                : undefined,
            maxWind: minMaxMatch
                ? Math.max(parseInt(minMaxMatch[2]), parseInt(minMaxMatch[4]))
                : undefined,
            runways: runways.flatMap((rwy) => {
                // Get specific wind data for each runway end
                const leData = rwyData.get(rwy.le.name)
                const heData = rwyData.get(rwy.he.name)

                return [
                    {
                        name: rwy.le.name,
                        heading: rwy.le.heading,
                        ...leData,
                        ...calculateWindComponents(
                            leData?.direction || parseInt(rwy1Dir),
                            leData?.speed || parseInt(rwy1Speed),
                            rwy.le.heading,
                        ),
                    },
                    {
                        name: rwy.he.name,
                        heading: rwy.he.heading,
                        ...heData,
                        ...calculateWindComponents(
                            heData?.direction || parseInt(rwy1Dir),
                            heData?.speed || parseInt(rwy1Speed),
                            rwy.he.heading,
                        ),
                    },
                ]
            }),
            timestamp: wxStore.time(icao),
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

    function getRunwayInUse(icao: string, dep: boolean = false) {
        if (vatsimStore.data && vatsimStore.data.atis) {
            const atis = vatsimStore.data.atis.find(
                (a) =>
                    a.callsign == `${icao}_ATIS` ||
                    a.callsign == (dep ? `${icao}_D_ATIS` : `${icao}_A_ATIS`),
            )
            if (atis && atis.text_atis && atis.text_atis.length > 0) {
                const rwyMatch = atis.text_atis.join(" ").match(/RWY (\d{2}[LRC]?) IN USE/)
                if (rwyMatch && rwyMatch[1]) return rwyMatch[1]
            }
        }
        if (wxAirports.includes(icao)) {
            let rwy = wxStore.rwy(icao)
            if (rwy) {
                const rwyEl = document.createElement("div")
                rwyEl.innerHTML = rwy
                rwy = rwyEl.innerText.replace("RUNWAY IN USE: ", "").trim()
                if (rwy.match(/^\d{2}[LRC]?$/)) return rwy
                if (!dep && rwy.match(/^ARR: \d{2}[LRC]?/)) {
                    const m = rwy.match(/^ARR: (\d{2}[LRC]?)/)
                    if (m && m[1]) return m[1]
                } else if (dep && rwy.match(/DEP: \d{2}[LRC]?/)) {
                    const m = rwy.match(/DEP: (\d{2}[LRC]?)/)
                    if (m && m[1]) return m[1]
                }
            }
        }
        // Fall back to max headwind runway
        let maxHeadWind = -Infinity
        let currentRunway = ""
        for (const runway of windData[icao].runways) {
            if (typeof runway.headWind != "undefined" && runway.headWind > maxHeadWind) {
                maxHeadWind = runway.headWind
                currentRunway = runway.name
            }
        }
        return currentRunway
    }

    function subscribe(icao: string) {
        const subscriptionId = uuid()
        subscriptions[subscriptionId] = icao
        if (wxAirports.includes(icao)) wxStore.subscribe(icao)
        if (metarAirports.includes(icao)) metarStore.subscribe(icao)
        windData[icao] = getWind(icao) || { runways: [] }
        return subscriptionId
    }

    function unsubscribe(subscription: string) {
        if (subscription in subscriptions) {
            const icao = subscriptions[subscription]
            delete subscriptions[subscription]
            wxStore.unsubscribe(icao)
            metarStore.unsubscribe(icao)
        }
    }

    watch([metarStore.metar, wxStore.wx], (newValue, oldValue) => {
        for (const icao of Object.values(subscriptions)) {
            windData[icao] = getWind(icao) || { runways: [] }
        }
    })

    return {
        windData,
        getWind,
        subscribe,
        unsubscribe,
        getRunwaysForAirport,
        getRunwayInUse,
    }
})
