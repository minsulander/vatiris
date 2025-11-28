import moment from "moment"
import { useAirportStore, type Airport } from "@/stores/airport"
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

export function closestAirport(pilot: any) {
    const from = turf.point([pilot.longitude, pilot.latitude])
    const airportStore = useAirportStore()
    if (!airportStore.airports) return undefined
    let minDistance = Infinity
    let closestAirport: Airport | undefined = undefined
    for (const airport of Object.values(airportStore.airports)) {
        if (!isFinite(airport.longitude) || !isFinite(airport.latitude)) continue
        const to = turf.point([airport.longitude, airport.latitude])
        const distance = turf.distance(from, to) / 1.852
        if (distance < minDistance) {
            minDistance = distance
            closestAirport = airport
        }
    }
    return closestAirport
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
 * Format TAS (True Airspeed) for FSP API
 * @param tas - Raw TAS value (e.g., "450", "N0450", "120")
 * @returns Formatted TAS string (e.g., "N0450", "N0120")
 */
export function formatTAS(tas: string | undefined): string | undefined {
    if (!tas) return undefined
    
    // If already in correct format (N followed by 4 digits), return as is
    if (/^N\d{4}$/.test(tas)) {
        return tas
    }
    
    // If it starts with M (Mach), return as is
    if (tas.startsWith('M')) {
        return tas
    }
    
    // Remove leading N if present
    const cleanTas = tas.replace(/^N/, '')
    
    // Try to parse as number
    const speed = parseInt(cleanTas)
    if (isNaN(speed)) return undefined
    
    // Format as N followed by 4 digits with leading zeros
    return `N${speed.toString().padStart(4, '0')}`
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
    
    const routeUpper = route?.toUpperCase() || ''
    const hasIfrInRoute = routeUpper.includes('IFR') || routeUpper.includes(' IFR ') || routeUpper.startsWith('IFR ') || routeUpper.endsWith(' IFR')
    const hasVfrInRoute = routeUpper.includes('VFR') || routeUpper.includes(' VFR ') || routeUpper.startsWith('VFR ') || routeUpper.endsWith(' VFR')
    
    // I and V might actually be Y or Z if route indicates rule changes
    if (flightRules === 'I' || flightRules === 'V') {
        // If filed IFR but route contains VFR, it's actually a Y flight
        if (flightRules === 'I' && hasVfrInRoute) {
            return hasIfrInRoute ? 'I' : 'V' // Currently operating under which rules
        }
        // If filed VFR but route contains IFR, it's actually a Z flight  
        if (flightRules === 'V' && hasIfrInRoute) {
            return 'I' // Currently operating under IFR
        }
        return flightRules
    }
    
    // Y and Z require checking the route for current operating rules
    if (flightRules === 'Y' || flightRules === 'Z') {
        // If route contains "IFR" string, the flight is currently or has transitioned to IFR
        
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
 * Normalize flight rules - detect Y/Z from I/V based on route content
 * Many pilots file as I/V when they should file Y/Z, this corrects it
 * 
 * @param flightRules - The filed flight rules (I, V, Y, or Z)
 * @param route - The flight plan route string
 * @returns Normalized flight rules (I, V, Y, or Z)
 */
export function normalizeFlightRules(flightRules: string | undefined, route: string | undefined): string | undefined {
    if (!flightRules || !route) return flightRules
    
    const routeUpper = route.toUpperCase()
    const hasIfrInRoute = routeUpper.includes('IFR') || routeUpper.includes(' IFR ') || routeUpper.startsWith('IFR ') || routeUpper.endsWith(' IFR')
    const hasVfrInRoute = routeUpper.includes('VFR') || routeUpper.includes(' VFR ') || routeUpper.startsWith('VFR ') || routeUpper.endsWith(' VFR')
    
    // If already Y or Z, keep it
    if (flightRules === 'Y' || flightRules === 'Z') {
        return flightRules
    }
    
    // Auto-detect Y: Filed as I (IFR) but route contains VFR
    if (flightRules === 'I' && hasVfrInRoute) {
        return 'Y'
    }
    
    // Auto-detect Z: Filed as V (VFR) but route contains IFR
    if (flightRules === 'V' && hasIfrInRoute) {
        return 'Z'
    }
    
    // Otherwise return as filed
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
    if (!route || !airport) {
        return { sid: null, cleanedRoute: route || "" }
    }

    // If runway is explicitly provided, use it (manual override)
    // Otherwise, try to extract from metreport (ATIS source)
    let detectedRunway = runway
    if (!detectedRunway && metreport) {
        detectedRunway = sidManager.getRunwayFromMetreport(metreport) || undefined
    }

    // If still no runway, try to find SID without runway constraint
    if (!detectedRunway) {
        const sids = sidManager.getSIDsForAirport(airport)
        for (const sid of sids) {
            const match = sidManager.findSIDInRoute(airport, sid.runway, route, flightRules)
            if (match) {
                return { sid: match, cleanedRoute: match.remainingRoute }
            }
        }
        return { sid: null, cleanedRoute: route }
    }

    // Extract runway number for SID lookup
    const runwayNumber = sidManager.extractRunwayNumber(detectedRunway)
    
    if (!runwayNumber) {
        return { sid: null, cleanedRoute: route }
    }

    // Find SID match
    const sidMatch = sidManager.findSIDInRoute(airport, runwayNumber, route, flightRules)
    
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