import { v4 as uuid } from "uuid"
import axios from "axios"
import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import * as turf from "@turf/turf"
import Papa from "papaparse"
import airportsData from "@/data/airports.csv?raw"

export interface Airport {
    icao: string
    latitude: number
    longitude: number
}

export interface Stand {
    center: [number, number]
    radius?: number
    coords?: [number, number][]
}

export const useAirportStore = defineStore("airport", () => {

    const airports = reactive({} as { [key: string]: Airport })
    const stands = reactive({} as { [key: string]: { [key: string]: Stand } })

    function getStandNameAtLocation(icao: string, lonlat: [number, number]) {
        if (icao in stands) {
            const near = [] as any[]
            for (const standName of Object.keys(stands[icao])) {
                const entry = {} as any
                Object.assign(entry, stands[icao][standName])
                const from = turf.point(lonlat)
                const to = turf.point([entry.center[0], entry.center[1]])
                const distance = turf.distance(from, to) * 1000
                entry.distance = distance
                entry.name = standName
                if (
                    (entry.radius && distance < entry.radius) ||
                    (!entry.radius && !entry.coords && distance < 20) ||
                    (entry.coords &&
                        entry.coords.length >= 3 &&
                        turf.booleanPointInPolygon(
                            turf.point(lonlat),
                            turf.polygon([[...entry.coords, entry.coords[0]]]),
                        ))
                )
                    near.push(entry)
            }
            if (near.length > 0)
                return near.sort((a, b) => a.distance - b.distance)[0].name
        }
        return ""
    }

    function loadAirports() {
        try {
            const results = Papa.parse(airportsData, { header: true })

            results.data.forEach((airport: any) => {
                if (airport.ident) {
                    airports[airport.ident.toUpperCase()] = {
                        icao: airport.ident,
                        latitude: parseFloat(airport.latitude_deg),
                        longitude: parseFloat(airport.longitude_deg),
                    } as Airport
                }
            })
        } catch (err) {
            console.error("Error loading airports data:", err)
        }
    }
    loadAirports()

    function loadStands() {
        import("@/data/stands.json").then((module) => {
            Object.assign(stands, module.default as any)
        })
    }
    loadStands()

    return {
        airports,
        stands,
        getStandNameAtLocation,
    }
})
