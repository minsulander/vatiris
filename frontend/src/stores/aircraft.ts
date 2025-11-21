import { defineStore } from "pinia"
import aircraftData from "@/data/ICAO_Aircraft.json"
import { RNP_AR_AIRPORTS } from "@/stores/airport"

export const useAircraftStore = defineStore("aircraft", () => {
    /**
     * Check if flight plan remarks contain PBN with T1
     * @param remarks Flight plan remarks field
     * @returns "1" if PBN/T1 is present in remarks, undefined otherwise
     */
    function getPBNT1(remarks: string | undefined): string | undefined {
        if (!remarks) return undefined
        // Regex pattern from VatScout to match PBN codes containing T1
        // Matches PBN/ followed by word characters and T1 (e.g., PBN/A1B1C1D1O1S1T1)
        const pbnT1Pattern = /PBN\/\w+T1/
        return remarks.match(pbnT1Pattern) ? "1" : undefined
    }

    /**
     * Get T1 code for RNP AR approaches
     * @param airport ICAO airport code
     * @param remarks Flight plan remarks field (to check for PBN/T1)
     * @returns T1 code if PBN/T1 is present and airport has RNP AR approaches, undefined otherwise
     */
    function getT1(airport: string | undefined, remarks: string | undefined): string | undefined {
        if (!airport) return undefined
        
        // Only return T1 for airports with RNP AR approaches
        if (!RNP_AR_AIRPORTS.includes(airport.toUpperCase())) return undefined
        
        // Check if PBN/T1 is present in remarks (no aircraft type dependency)
        return getPBNT1(remarks)
    }

    /**
     * Get wake turbulence category (WTC) for an aircraft type
     * @param aircraftType ICAO aircraft type code (e.g., "A320")
     * @returns WTC (L, M, H) or undefined if not found
     */
    function getWTC(aircraftType: string | undefined): string | undefined {
        if (!aircraftType) return undefined
        const aircraft = (aircraftData as any[]).find((a: any) => a.ICAO === aircraftType.toUpperCase())
        return aircraft?.WTC
    }

    /**
     * Check if aircraft WTC is not Medium (M)
     * @param aircraftType ICAO aircraft type code (e.g., "A320")
     * @returns true if WTC exists and is not "M"
     */
    function isNotMediumWTC(aircraftType: string | undefined): boolean {
        const wtc = getWTC(aircraftType)
        return wtc !== undefined && wtc !== "M"
    }

    /**
     * Check if aircraft is slow based on Stockholm LPM criteria (from VatScout)
     * Slow aircraft are:
     * - All propeller driven aircraft of wake turbulence category LIGHT, except P180
     * - Specific medium category aircraft: ATP, AT43, AT45, AT72, AT75, AT76, B190, C212, D328, DH8A, DH8B, DH8C, E120, F27, F50, JS31, JS32, JS41, S100, SF34, SH33, SH36, SW4, T100
     * @param aircraftType ICAO aircraft type code (e.g., "A320")
     * @param flightRules Flight rules (V = VFR, I = IFR, etc.)
     * @returns true if aircraft is considered slow
     */
    function isSlowAircraft(aircraftType: string | undefined, flightRules: string | undefined): boolean {
        if (!aircraftType) return false
        // Exclude VFR flights
        if (flightRules === "V") return false
        
        // Find aircraft in ICAO_Aircraft.json
        const aircraft = (aircraftData as any[]).find((a: any) => a.ICAO === aircraftType.toUpperCase())
        if (!aircraft) return false
        
        const wtc = aircraft.WTC
        const description = aircraft.Description
        
        // Light category: All propeller driven (not jet) except P180
        if (wtc === "L") {
            // Description format: L1P, L2T, etc. - 3rd character is engine type (J=Jet, P=Piston, T=Turboprop)
            // If 3rd character is not J (jet), it's propeller-driven
            if (description && description.length >= 3 && description[2] !== "J" && aircraftType.toUpperCase() !== "P180") {
                return true
            }
        }
        
        // Medium category: Specific list of slow medium aircraft
        if (wtc === "M") {
            const slowMediums = ["ATP", "AT43", "AT45", "AT72", "AT75", "AT76", "B190", "C212", "D328", "DH8A", "DH8B", "DH8C", "E120", "F27", "F50", "JS31", "JS32", "JS41", "S100", "SF34", "SH33", "SH36", "SW4", "T100"]
            if (slowMediums.includes(aircraftType.toUpperCase())) {
                return true
            }
        }
        
        return false
    }

    return {
        getT1,
        isSlowAircraft,
        isNotMediumWTC,
    }
})

