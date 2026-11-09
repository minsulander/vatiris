/** Public MAESTRO view consumed by TopSky, without SAAMAN recovery data. */
export function topSkySequence(sequence: any): Record<string, any> | undefined {
    if (!sequence || typeof sequence !== "object" || !sequence.data || !Array.isArray(sequence.sequence)) return undefined

    let rows = sequence.sequence
    if (sequence.saamanRelay !== undefined) {
        const relay = sequence.saamanRelay
        // A recognized SAAMAN publication must have its matching engine
        // snapshot. An incomplete checkpoint must never restore obsolete tags.
        if (!relay || relay.protocol !== "saaman-legacy-1") return undefined
        const checkpoint = relay.checkpoint, snapshot = checkpoint?.snapshot
        if (checkpoint?.schema !== "saaman-1.1.9" || !snapshot || !Array.isArray(snapshot.flights) || snapshot.flights.length > 500 ||
            !Number.isFinite(snapshot.timestamp) || Math.round(snapshot.timestamp / 1000) !== sequence.data.timestamp) return undefined
        const flights = new Map<string, any>()
        for (const flight of snapshot.flights) {
            if (!flight || typeof flight.callsign !== "string" || !/^[A-Z0-9_-]{2,16}$/.test(flight.callsign) || flights.has(flight.callsign) ||
                !Number.isInteger(flight.state) || flight.state < 0 || flight.state > 4 ||
                flight.passedFeeder !== undefined && typeof flight.passedFeeder !== "boolean" ||
                flight.line0Suppressed !== undefined && typeof flight.line0Suppressed !== "boolean") return undefined
            flights.set(flight.callsign, flight)
        }
        if (rows.some((row: any) => !row || typeof row.callsign !== "string" || !flights.has(row.callsign))) return undefined
        // Match the DLL's toTopSkySequence projection. Genuine upstream L00
        // rows and HOLD rows remain; zero itself never means obsolete guidance.
        rows = rows.filter((row: any) => {
            const flight = flights.get(row.callsign)
            return !flight.passedFeeder && !flight.line0Suppressed && flight.state !== 4
        })
    }

    const result: Record<string, any> = {}
    for (const key of ["data", "wind", "airports", "runways", "feeders"]) if (sequence[key] !== undefined) result[key] = sequence[key]
    result.sequence = rows
    return result
}
