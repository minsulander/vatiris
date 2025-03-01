import { v4 as uuid } from "uuid"
import axios from "axios"
import { defineStore } from "pinia"
import { reactive, ref } from "vue"
import Papa from "papaparse"
import airportsData from "@/data/airports.csv?raw"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

export interface Airport {
    icao: string
    latitude: number
    longitude: number
}

export const useAirportStore = defineStore("airport", () => {

    const airports = reactive({} as { [key: string]: Airport })

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

    return {
        airports
    }
})
