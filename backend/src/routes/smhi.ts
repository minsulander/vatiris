import { Router, Request, Response } from "express"
import axios from "axios"
import fs from "fs"
import path from "path"
import Papa from "papaparse"

const smhi = Router()

// SMHI Open Data API base URL
// Documentation: https://www.smhi.se/data/sok-oppna-data-i-utforskaren/
// Temperature: parameter 1 (Lufttemperatur - momentanvärde)
// Dewpoint: parameter 39 (Daggpunktstemperatur - Dewpoint temperature)
// Relative Humidity: parameter 6
// Air Pressure (QNH): parameter 9 (Lufttryck reducerat havsytans nivå - reduced to sea level)
// Visibility: parameter 12 (Sikt - Horizontal visibility in meters)
const SMHI_API_BASE = "https://opendata-download-metobs.smhi.se/api"

interface AirportCoords {
    latitude: number
    longitude: number
}

// Load airport coordinates from CSV file
function loadAirportCoords(): { [key: string]: AirportCoords } {
    const coords: { [key: string]: AirportCoords } = {}
    try {
        // Try multiple possible paths (dev and compiled)
        const possiblePaths = [
            path.join(__dirname, "../../data/airports.csv"), // Compiled
            path.join(process.cwd(), "backend/data/airports.csv"), // From project root
            path.join(process.cwd(), "data/airports.csv"), // Direct
        ]

        let csvPath: string | null = null
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                csvPath = p
                break
            }
        }

        if (!csvPath) {
            console.error("Could not find airports.csv file")
            return coords
        }

        const csvData = fs.readFileSync(csvPath, "utf-8")
        const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true })

        for (const row of parsed.data as any[]) {
            if (row.ident && row.latitude_deg && row.longitude_deg) {
                const icao = row.ident.toUpperCase()
                const lat = parseFloat(row.latitude_deg)
                const lon = parseFloat(row.longitude_deg)

                if (!isNaN(lat) && !isNaN(lon)) {
                    coords[icao] = {
                        latitude: lat,
                        longitude: lon,
                    }
                }
            }
        }
    } catch (error: any) {
        console.error("Error loading airport coordinates:", error.message)
    }
    return coords
}

// Load coordinates at startup
const airportCoords = loadAirportCoords()
console.log(`Loaded coordinates for ${Object.keys(airportCoords).length} airports`)

interface SmhiResponse {
    temperature?: number
    dewpoint?: number
    qnh?: number
    humidity?: number
    visibility?: number  // Visibility in meters
    timestamp?: string
}

interface SmhiStation {
    key: string
    name: string
    latitude: number
    longitude: number
    value: Array<{
        date: number
        value: string
        quality: string
    }>
}

interface SmhiDataResponse {
    station: SmhiStation[]
}

// Cache for station data
let temperatureStations: SmhiStation[] | null = null
let dewpointStations: SmhiStation[] | null = null
let humidityStations: SmhiStation[] | null = null
let pressureStations: SmhiStation[] | null = null
let visibilityStations: SmhiStation[] | null = null
let stationsCacheTime = 0
const STATIONS_CACHE_DURATION = 3600000 // 1 hour for station lists

// Cache for airport-specific responses
// SMHI data updates hourly, so cache for 55 minutes to ensure fresh data
interface AirportCacheEntry {
    response: SmhiResponse
    timestamp: number
}
const airportCache = new Map<string, AirportCacheEntry>()
const AIRPORT_CACHE_DURATION = 55 * 60 * 1000 // 55 minutes

// A station farther than this is not representative of the aerodrome.
// Visibility stations are sparse, so that parameter allows a wider radius.
const MAX_STATION_DISTANCE_KM = 40
const MAX_VISIBILITY_DISTANCE_KM = 80

function readNearValue(
    nearest: { station: SmhiStation; distance: number } | null,
    maxKm: number,
): number | undefined {
    if (!nearest || nearest.distance > maxKm) return undefined
    const latest = nearest.station.value[nearest.station.value.length - 1]
    const value = parseFloat(latest?.value)
    return isNaN(value) ? undefined : value
}

// Fetch station data from SMHI API
async function getStationData(parameter: number): Promise<SmhiStation[]> {
    try {
        const response = await axios.get<SmhiDataResponse>(
            `${SMHI_API_BASE}/version/1.0/parameter/${parameter}/station-set/all/period/latest-hour/data.json`,
            { timeout: 30000 }
        )
        return response.data.station || []
    } catch (error: any) {
        // Silently handle 404s - these parameters may not exist
        if (error.response?.status === 404) {
            // Parameter doesn't exist, return empty array
            return []
        }
        // Log other errors (network errors, timeouts, etc.) but don't spam the console
        if (error.code !== 'ECONNABORTED') {
            console.error(`Error fetching SMHI station data for parameter ${parameter}:`, error.message)
        }
        return []
    }
}

// Find nearest station to coordinates
function findNearestStation(
    stations: SmhiStation[],
    latitude: number,
    longitude: number
): { station: SmhiStation; distance: number } | null {
    let nearest: { station: SmhiStation; distance: number } | null = null

    for (const station of stations) {
        if (!station.latitude || !station.longitude) continue

        // Only consider stations with valid data
        if (!station.value || station.value.length === 0) continue

        // Check if the latest value has good quality
        const latestValue = station.value[station.value.length - 1]
        if (latestValue.quality !== "G" && latestValue.quality !== "Y") continue

        // Calculate distance using Haversine formula
        const R = 6371 // Earth's radius in km
        const dLat = ((station.latitude - latitude) * Math.PI) / 180
        const dLon = ((station.longitude - longitude) * Math.PI) / 180
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((latitude * Math.PI) / 180) *
                Math.cos((station.latitude * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const distance = R * c

        if (!nearest || distance < nearest.distance) {
            nearest = { station, distance }
        }
    }

    return nearest
}

smhi.get("/", async (req: Request, res: Response) => {
    try {
        const icao = (req.query.icao as string)?.toUpperCase()
        if (!icao) {
            return res.status(400).json({ error: "Missing ICAO code" })
        }

        // Get airport coordinates
        const coords = airportCoords[icao]
        if (!coords) {
            return res.status(404).json({ error: `Coordinates not available for ${icao}` })
        }

        // Check airport-specific cache first
        const now = Date.now()
        const cachedEntry = airportCache.get(icao)
        if (cachedEntry && now - cachedEntry.timestamp < AIRPORT_CACHE_DURATION) {
            // Return cached response with cache headers
            // Set cache headers per SMHI's recommendation to use client-cache directives
            const age = Math.floor((now - cachedEntry.timestamp) / 1000) // Age in seconds
            res.setHeader("Cache-Control", `public, max-age=${Math.floor(AIRPORT_CACHE_DURATION / 1000)}`)
            res.setHeader("Age", age.toString())
            return res.json(cachedEntry.response)
        }

        // Fetch station data (with caching)
        if (!temperatureStations || now - stationsCacheTime > STATIONS_CACHE_DURATION) {
            console.log("Fetching SMHI station data...")
            const [tempData, dewData, humData, pressData, visData] = await Promise.allSettled([
                getStationData(1), // Temperature - Lufttemperatur
                getStationData(39), // Dewpoint - Daggpunktstemperatur
                getStationData(6), // Relative Humidity
                getStationData(9), // Air Pressure (QNH) - Lufttryck reducerat havsytans nivå
                getStationData(12), // Visibility - Sikt
            ])
            temperatureStations = tempData.status === "fulfilled" ? tempData.value : []
            dewpointStations = dewData.status === "fulfilled" ? dewData.value : []
            humidityStations = humData.status === "fulfilled" ? humData.value : []
            pressureStations = pressData.status === "fulfilled" ? pressData.value : []
            visibilityStations = visData.status === "fulfilled" ? visData.value : []
            stationsCacheTime = now
            console.log(
                `Loaded ${temperatureStations.length} temperature stations, ${dewpointStations.length} dewpoint stations, ${humidityStations.length} humidity stations, ${pressureStations.length} pressure stations, and ${visibilityStations.length} visibility stations`
            )
        }

        if (!temperatureStations || temperatureStations.length === 0) {
            return res.status(503).json({ error: "Unable to fetch SMHI station data" })
        }

        // Find nearest stations
        const nearestTempStation = findNearestStation(temperatureStations, coords.latitude, coords.longitude)
        const temperature = readNearValue(nearestTempStation, MAX_STATION_DISTANCE_KM)
        if (temperature === undefined || !nearestTempStation) {
            return res.status(404).json({ error: `No nearby temperature station with valid data found for ${icao}` })
        }
        const tempLatest = nearestTempStation.station.value[nearestTempStation.station.value.length - 1]
        const timestamp = new Date(tempLatest.date).toISOString()

        const dewpointRaw = dewpointStations?.length
            ? readNearValue(findNearestStation(dewpointStations, coords.latitude, coords.longitude), MAX_STATION_DISTANCE_KM)
            : undefined
        const dewpoint = dewpointRaw !== undefined && dewpointRaw >= -50 && dewpointRaw <= 50 ? dewpointRaw : undefined

        const humidityRaw = humidityStations?.length
            ? readNearValue(findNearestStation(humidityStations, coords.latitude, coords.longitude), MAX_STATION_DISTANCE_KM)
            : undefined
        const humidity = humidityRaw !== undefined && humidityRaw >= 0 && humidityRaw <= 100 ? humidityRaw : undefined

        const qnhRaw = pressureStations?.length
            ? readNearValue(findNearestStation(pressureStations, coords.latitude, coords.longitude), MAX_STATION_DISTANCE_KM)
            : undefined
        const qnh = qnhRaw !== undefined && qnhRaw > 850 && qnhRaw < 1100 ? qnhRaw : undefined

        const visibilityRaw = visibilityStations?.length
            ? readNearValue(
                  findNearestStation(visibilityStations, coords.latitude, coords.longitude),
                  MAX_VISIBILITY_DISTANCE_KM,
              )
            : undefined
        const visibility = visibilityRaw !== undefined && visibilityRaw >= 0 && visibilityRaw <= 100000 ? visibilityRaw : undefined

        const response: SmhiResponse = {
            temperature,
            dewpoint: dewpoint,
            humidity: humidity,
            qnh: qnh,
            visibility: visibility,
            timestamp,
        }

        // Check if we have any valid data
        if (response.temperature === undefined) {
            return res.status(404).json({ error: `No SMHI data available for ${icao}` })
        }

        // Cache the response
        airportCache.set(icao, {
            response,
            timestamp: now,
        })

        // Clean up old cache entries (older than 2 hours) to prevent memory leaks
        const twoHoursAgo = now - (2 * 60 * 60 * 1000)
        for (const [key, entry] of airportCache.entries()) {
            if (entry.timestamp < twoHoursAgo) {
                airportCache.delete(key)
            }
        }

        // Set cache headers per SMHI's recommendation to use client-cache directives
        res.setHeader("Cache-Control", `public, max-age=${Math.floor(AIRPORT_CACHE_DURATION / 1000)}`)
        res.setHeader("Age", "0")

        return res.json(response)
    } catch (error: any) {
        console.error("SMHI API error:", error)
        res.status(500).json({ error: "Internal server error", message: error.message })
    }
})

export default smhi
