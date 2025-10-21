import moment from "moment"
import { useAirportStore } from "@/stores/airport"
import * as turf from "@turf/turf"
import { sidManager, type SIDMatch } from "@/sid"

export function departureDistance(pilot: any) {
    if (
        !pilot ||
        !pilot.longitude ||
        !pilot.latitude ||
        !pilot.flight_plan ||
        !pilot.flight_plan.departure
    )
        return Infinity
    const airport = useAirportStore()
    return distanceToAirport(pilot, airport.airports[pilot.flight_plan.departure])
}

export function arrivalDistance(pilot: any) {
    if (
        !pilot ||
        !pilot.longitude ||
        !pilot.latitude ||
        !pilot.flight_plan ||
        !pilot.flight_plan.arrival
    )
        return Infinity
        const airport = useAirportStore()
        return distanceToAirport(pilot, airport.airports[pilot.flight_plan.arrival])
}

export function distanceToAirport(pilot: any, airport: any) {
    if (!airport || !isFinite(airport.longitude) || !isFinite(airport.latitude)) return Infinity
    const from = turf.point([pilot.longitude, pilot.latitude])
    const to = turf.point([airport.longitude, airport.latitude])
    const distance = turf.distance(from, to) / 1.852
    return distance
}

export function flightplanArrivalTime(fp: any, adjustDepartureTime = false) {
    if (!fp || !fp.deptime || fp.deptime == "0000" || !fp.enroute_time || fp.enroute_time == "0000") return undefined
    let depHours = parseInt(fp.deptime.substring(0, 2))
    let depMinutes = parseInt(fp.deptime.substring(2, 4))
    if (adjustDepartureTime && flightplanDepartureTime(fp)?.isBefore(moment())) {
        depHours = moment().utc().get("hour")
        depMinutes = moment().utc().get("minute")
    }
    const enrHours = parseInt(fp.enroute_time.substring(0, 2))
    const enrMinutes = parseInt(fp.enroute_time.substring(2, 4))
    let arrHours = depHours + enrHours
    let arrMinutes = depMinutes + enrMinutes
    while (arrMinutes >= 60) {
        arrHours += 1
        arrMinutes -= 60
    }
    if (arrHours >= 24) arrHours -= 24
    let time = moment().utc().set("hour", arrHours).set("minute", arrMinutes)
    if (time.isBefore(moment())) time = time.add(1, "day")
    return time
}

export function flightplanDepartureTime(fp: any) {
    if (!fp ||!fp.deptime || fp.deptime == "0000" || !fp.enroute_time || fp.enroute_time == "0000") return undefined
    const depHours = parseInt(fp.deptime.substring(0, 2))
    const depMinutes = parseInt(fp.deptime.substring(2, 4))
    let time = moment().utc().set("hour", depHours).set("minute", depMinutes)
    if (time.isBefore(moment().subtract(6, "hour"))) time = time.add(1, "day")
    return time
}

/**
 * Format altitude/flight level for FSP API
 * @param altitude - Raw altitude string (e.g., "38000", "5000")
 * @returns Formatted RFL string (e.g., "F380" for FL380, "A050" for 5000ft)
 */
export function formatRFL(altitude: string | undefined): string | undefined {
    if (!altitude) return undefined
    
    const alt = parseInt(altitude)
    if (isNaN(alt)) return undefined
    
    // Altitudes 5000 feet or lower use A format (A050)
    if (alt <= 5000) {
        const hundreds = Math.floor(alt / 100)
        return `A${hundreds.toString().padStart(3, '0')}`
    }
    
    // Flight levels above 5000 feet use F format (F380)
    const flightLevel = Math.floor(alt / 100)
    return `F${flightLevel.toString().padStart(3, '0')}`
}

/**
 * Determine the effective flight rules for a flight
 * Handles Y and Z flight rules (flights with planned rule changes)
 * 
 * @param flightRules - The filed flight rules (I, V, Y, or Z)
 * @param route - The flight plan route string
 * @returns The effective flight rules ('I' for IFR, 'V' for VFR, or original if not Y/Z)
 */
export function getEffectiveFlightRules(flightRules: string | undefined, route: string | undefined): string | undefined {
    if (!flightRules) return undefined
    
    // I and V are straightforward
    if (flightRules === 'I' || flightRules === 'V') {
        return flightRules
    }
    
    // Y and Z require checking the route for "IFR" string
    if (flightRules === 'Y' || flightRules === 'Z') {
        // If route contains "IFR" string, the flight is currently or has transitioned to IFR
        const hasIfrInRoute = route?.toUpperCase().includes('IFR') || false
        
        if (flightRules === 'Y') {
            // Y: Filed IFR with rule change
            // If "IFR" is in route, they're reverting/confirming IFR after a VFR segment
            return hasIfrInRoute ? 'I' : 'V'
        } else {
            // Z: Filed VFR with rule change
            // If "IFR" is in route, they're transitioning to IFR
            return hasIfrInRoute ? 'I' : 'V'
        }
    }
    
    // Return original if unrecognized format
    return flightRules
}

/**
 * Process route to extract SID information and return cleaned route
 * @param airport - ICAO airport code
 * @param runway - Runway identifier (e.g., "01L", "19R")
 * @param route - Original route string
 * @param metreport - Optional metreport data for runway detection
 * @returns Object with SID info and cleaned route
 */
export function processRouteWithSID(
    airport: string, 
    route: string | undefined, 
    runway?: string | undefined,
    metreport?: string | undefined,
    flightRules?: string | undefined
): { sid: SIDMatch | null; cleanedRoute: string } {
    console.log('[FLIGHTCALC] === processRouteWithSID ===')
    console.log(`[FLIGHTCALC] Airport: ${airport}`)
    console.log(`[FLIGHTCALC] Route: ${route}`)
    console.log(`[FLIGHTCALC] Runway param: ${runway}`)
    console.log(`[FLIGHTCALC] Metreport: ${metreport}`)
    console.log(`[FLIGHTCALC] Flight Rules: ${flightRules}`)
    
    if (!route || !airport) {
        console.log('[FLIGHTCALC] ❌ No route or airport provided')
        return { sid: null, cleanedRoute: route || "" }
    }

    // If no runway provided, try to extract from metreport
    let detectedRunway = runway
    if (!detectedRunway && metreport) {
        detectedRunway = sidManager.getRunwayFromMetreport(metreport)
        console.log(`[FLIGHTCALC] Runway extracted from metreport: ${detectedRunway}`)
    }

    // If still no runway, try to find SID without runway constraint
    if (!detectedRunway) {
        console.log('[FLIGHTCALC] No runway detected, trying all runways...')
        const sids = sidManager.getSIDsForAirport(airport)
        console.log(`[FLIGHTCALC] Checking ${sids.length} SIDs for all runways`)
        for (const sid of sids) {
            const match = sidManager.findSIDInRoute(airport, sid.runway, route, flightRules)
            if (match) {
                console.log(`[FLIGHTCALC] ✅ Found SID match: ${match.sidName}`)
                return { sid: match, cleanedRoute: match.remainingRoute }
            }
        }
        console.log('[FLIGHTCALC] ❌ No SID found for any runway')
        return { sid: null, cleanedRoute: route }
    }

    // Extract runway number for SID lookup
    const runwayNumber = sidManager.extractRunwayNumber(detectedRunway)
    console.log(`[FLIGHTCALC] Runway number extracted: ${runwayNumber} (from ${detectedRunway})`)
    
    if (!runwayNumber) {
        console.log('[FLIGHTCALC] ❌ Invalid runway number')
        return { sid: null, cleanedRoute: route }
    }

    // Find SID match
    const sidMatch = sidManager.findSIDInRoute(airport, runwayNumber, route, flightRules)
    
    if (sidMatch) {
        console.log(`[FLIGHTCALC] ✅ SID Match: ${sidMatch.sidName}`)
        console.log(`[FLIGHTCALC] Cleaned Route: ${sidMatch.remainingRoute}`)
    } else {
        console.log('[FLIGHTCALC] ❌ No SID match found')
    }
    
    return {
        sid: sidMatch,
        cleanedRoute: sidMatch ? sidMatch.remainingRoute : route
    }
}

/**
 * Get SID information for a flight
 * @param airport - ICAO airport code
 * @param route - Route string
 * @param runway - Optional runway identifier
 * @param metreport - Optional metreport data
 * @param flightRules - Optional flight rules (I/V/Y/Z)
 * @returns SID name if found, undefined otherwise
 */
export function getSIDName(
    airport: string, 
    route: string | undefined, 
    runway?: string | undefined,
    metreport?: string | undefined,
    flightRules?: string | undefined
): string | undefined {
    const { sid } = processRouteWithSID(airport, route, runway, metreport, flightRules)
    return sid?.sidName
}

/**
 * Get cleaned route with SID removed
 * @param airport - ICAO airport code
 * @param route - Route string
 * @param runway - Optional runway identifier
 * @param metreport - Optional metreport data
 * @param flightRules - Optional flight rules (I/V/Y/Z)
 * @returns Cleaned route string
 */
export function getCleanedRoute(
    airport: string, 
    route: string | undefined, 
    runway?: string | undefined,
    metreport?: string | undefined,
    flightRules?: string | undefined
): string {
    const { cleanedRoute } = processRouteWithSID(airport, route, runway, metreport, flightRules)
    return cleanedRoute
}