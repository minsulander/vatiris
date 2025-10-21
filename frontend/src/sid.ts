import SID_DATA from "@/data/SID.txt?raw"

export interface SIDEntry {
    airport: string
    runway: string
    sidName: string
    waypoints: string[]
}

export interface SIDMatch {
    sidName: string
    waypoints: string[]
    remainingRoute: string
}

class SIDManager {
    private sids: SIDEntry[] = []
    private initialized = false

    private parseSIDData(): void {
        if (this.initialized) return

        const lines = SID_DATA.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
            // Format: SID:ESGG:03:DETNA3M:GG401 GG901 GG902 DETNA
            const parts = line.split(':')
            if (parts.length < 5) continue

            const airport = parts[1].trim()
            const runway = parts[2].trim()
            const sidName = parts[3].trim()
            // Trim each waypoint to remove any carriage returns or whitespace
            const waypoints = parts[4].split(' ').filter(wp => wp.trim()).map(wp => wp.trim())

            this.sids.push({
                airport,
                runway,
                sidName,
                waypoints
            })
        }

        this.initialized = true
    }

    /**
     * Get all SIDs for a specific airport and runway
     */
    getSIDsForRunway(airport: string, runway: string): SIDEntry[] {
        this.parseSIDData()
        return this.sids.filter(sid => 
            sid.airport === airport && sid.runway === runway
        )
    }

    /**
     * Get all SIDs for a specific airport (any runway)
     */
    getSIDsForAirport(airport: string): SIDEntry[] {
        this.parseSIDData()
        return this.sids.filter(sid => sid.airport === airport)
    }

    /**
     * Find SID match in route and return SID info with remaining route
     */
    findSIDInRoute(airport: string, runway: string, route: string, flightRules?: string): SIDMatch | null {
        console.log('[SID] === SID Detection Start ===')
        console.log(`[SID] Airport: ${airport}, Runway: ${runway}`)
        console.log(`[SID] Route: ${route}`)
        console.log(`[SID] Flight Rules: ${flightRules}`)
        
        if (!route) {
            console.log('[SID] ❌ No route provided')
            return null
        }

        this.parseSIDData()
        const sids = this.getSIDsForRunway(airport, runway)
        
        console.log(`[SID] Found ${sids.length} SIDs for ${airport} RWY ${runway}`)
        if (sids.length > 0) {
            console.log('[SID] Available SIDs:', sids.map(s => s.sidName).join(', '))
        } else {
            console.log(`[SID] ⚠️  No SIDs available for ${airport} RWY ${runway}`)
            console.log('[SID] Trying all runways for this airport...')
            const allSids = this.getSIDsForAirport(airport)
            console.log(`[SID] Total SIDs for ${airport}:`, allSids.map(s => `${s.sidName} (RWY ${s.runway})`).join(', '))
        }
        
        // Check if this is a VFR flight
        const isVFR = flightRules === 'V'
        if (isVFR) {
            console.log('[SID] ⚠️  VFR flight detected - only matching explicit VFR SIDs')
        }
        
        // Priority 1: Check if route contains explicit SID name (highest priority)
        console.log('[SID] === Pass 1: Checking for explicit SID names ===')
        for (const sid of sids) {
            // For VFR flights, only check VFR SIDs in Pass 1
            if (isVFR && !sid.sidName.startsWith('VFR·')) {
                continue
            }
            
            console.log(`[SID] Testing ${sid.sidName} for explicit match...`)
            const match = this.matchSIDByName(sid, route)
            if (match) {
                console.log(`[SID] ✅ MATCHED by SID name: ${match.sidName}`)
                console.log(`[SID] Cleaned route: ${match.remainingRoute}`)
                console.log('[SID] === SID Detection End ===')
                return match
            }
        }

        // Priority 2: Check by waypoint (respects order in SID file)
        // Skip this pass entirely for VFR flights
        if (isVFR) {
            console.log('[SID] === Pass 2: Skipped for VFR flight ===')
            console.log('[SID] ❌ No VFR SID found in route')
            console.log('[SID] === SID Detection End ===')
            return null
        }
        
        console.log('[SID] === Pass 2: Checking by waypoint (file order) ===')
        for (const sid of sids) {
            // Skip VFR SIDs in waypoint matching
            if (sid.sidName.startsWith('VFR·')) {
                continue
            }
            
            console.log(`[SID] Testing ${sid.sidName} for waypoint match...`)
            const match = this.matchSIDByWaypoint(sid, route)
            if (match) {
                console.log(`[SID] ✅ MATCHED by waypoint: ${match.sidName}`)
                console.log(`[SID] Cleaned route: ${match.remainingRoute}`)
                console.log('[SID] === SID Detection End ===')
                return match
            }
        }

        console.log('[SID] ❌ No SID match found')
        console.log('[SID] === SID Detection End ===')
        return null
    }

    /**
     * Match SID by explicit SID name in route
     */
    private matchSIDByName(sid: SIDEntry, route: string): SIDMatch | null {
        const routeParts = route.split(' ').filter(part => part.trim())
        if (routeParts.length === 0) return null
        
        const firstElement = routeParts[0]
        
        // Check for exact SID name (e.g., "NEGIL2G")
        if (firstElement === sid.sidName) {
            console.log(`[SID]   ✓ Route starts with SID name "${sid.sidName}"`)
            // Remove the SID name, keep remaining route
            const remainingRoute = this.cleanRoute(routeParts.slice(1).join(' '))
            
            return {
                sidName: this.formatSIDName(sid.sidName),
                waypoints: sid.waypoints,
                remainingRoute
            }
        }

        // Check for SID with runway notation (e.g., "NEGIL2G/21")
        if (firstElement.startsWith(sid.sidName + '/')) {
            console.log(`[SID]   ✓ Route starts with SID name with runway "${firstElement}"`)
            // Remove the SID name with /runway, keep remaining route
            const remainingRoute = this.cleanRoute(routeParts.slice(1).join(' '))
            
            return {
                sidName: this.formatSIDName(sid.sidName),
                waypoints: sid.waypoints,
                remainingRoute
            }
        }

        // Check for VFR SID (e.g., "VFR·ASPE" or "VFR·ASPE/21")
        if (sid.sidName.startsWith('VFR·')) {
            // Check if first element is the VFR SID (with or without runway)
            if (firstElement === sid.sidName || firstElement.startsWith(sid.sidName + '/')) {
                console.log(`[SID]   ✓ Route starts with VFR SID "${firstElement}"`)
                // Remove the VFR SID, keep remaining route
                const remainingRoute = this.cleanRoute(routeParts.slice(1).join(' '))
                
                return {
                    sidName: this.formatSIDName(sid.sidName),
                    waypoints: sid.waypoints,
                    remainingRoute
                }
            }
            
            // Also check for pattern without "VFR·" prefix (e.g., "ASPE/21")
            const vfrPattern = sid.sidName.replace('VFR·', '')
            if (firstElement === vfrPattern || firstElement.startsWith(vfrPattern + '/')) {
                console.log(`[SID]   ✓ Route starts with VFR SID (no prefix) "${firstElement}"`)
                // Remove the VFR SID, keep remaining route
                const remainingRoute = this.cleanRoute(routeParts.slice(1).join(' '))
                
                return {
                    sidName: this.formatSIDName(sid.sidName),
                    waypoints: sid.waypoints,
                    remainingRoute
                }
            }
        }

        return null
    }

    /**
     * Match SID by waypoint at start of route
     */
    private matchSIDByWaypoint(sid: SIDEntry, route: string): SIDMatch | null {
        const routeParts = route.split(' ').filter(part => part.trim())
        
        if (sid.waypoints.length === 0) return null
        
        const lastWaypoint = sid.waypoints[sid.waypoints.length - 1]
        
        if (routeParts[0] === lastWaypoint) {
            console.log(`[SID]   ✓ Route starts with last SID waypoint "${lastWaypoint}"`)
            // Keep the waypoint in the route, just clean up speed/altitude codes
            return {
                sidName: this.formatSIDName(sid.sidName),
                waypoints: sid.waypoints,
                remainingRoute: this.cleanRoute(route)
            }
        }

        return null
    }

    /**
     * Clean route by removing speed/altitude codes (e.g., N0442F360)
     * These codes start with N followed by 4 digits, then F followed by 3 digits
     */
    private cleanRoute(route: string): string {
        const parts = route.split(' ').filter(part => part.trim())
        
        // Filter out speed/altitude codes like N0442F360
        const cleaned = parts.filter(part => {
            // Pattern: N + 4 digits + F + 3 digits (e.g., N0442F360)
            const speedAltPattern = /^N\d{4}F\d{3}$/
            return !speedAltPattern.test(part)
        })
        
        return cleaned.join(' ')
    }

    /**
     * Format SID name - removes VFR· prefix for VFR SIDs
     */
    private formatSIDName(sidName: string): string {
        if (sidName.startsWith('VFR·')) {
            return sidName.substring(4) // Remove "VFR·" prefix
        }
        return sidName
    }

    /**
     * Get runway from metreport data
     */
    getRunwayFromMetreport(metreport: string): string | null {
        console.log('[SID] === Runway Detection from Metreport ===')
        console.log(`[SID] Metreport length: ${metreport?.length || 0}`)
        
        if (!metreport) {
            console.log('[SID] ❌ No metreport provided')
            return null
        }

        console.log(`[SID] Metreport preview: ${metreport.substring(0, 200)}...`)

        // Look for runway information in metreport
        // Format: "RWY 01L/19R" or "ARR: 01L DEP: 19R"
        const rwyMatch = metreport.match(/RWY\s+([A-Z0-9/]+)/i)
        if (rwyMatch) {
            const runway = rwyMatch[1].split('/')[0] // Return first runway for departures
            console.log(`[SID] ✅ Found runway from RWY pattern: ${runway}`)
            return runway
        }

        const depMatch = metreport.match(/DEP:\s*([A-Z0-9]+)/i)
        if (depMatch) {
            console.log(`[SID] ✅ Found runway from DEP pattern: ${depMatch[1]}`)
            return depMatch[1]
        }

        console.log('[SID] ❌ No runway found in metreport')
        return null
    }

    /**
     * Extract runway number from runway string (e.g., "01L" -> "01")
     */
    extractRunwayNumber(runway: string): string {
        if (!runway) return ""
        const match = runway.match(/^(\d+)/)
        return match ? match[1] : ""
    }
}

// Export singleton instance
export const sidManager = new SIDManager()
