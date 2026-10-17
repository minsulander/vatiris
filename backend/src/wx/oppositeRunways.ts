/** Opposite runway ends used when matching SCC keys to ARR/DEP designations (ESSA). */
const oppositePairs: [string, string][] = [
    ["08", "26"],
    ["01L", "19R"],
    ["01R", "19L"],
]

const oppositeMap: { [rwy: string]: string } = {}
for (const [a, b] of oppositePairs) {
    oppositeMap[a] = b
    oppositeMap[b] = a
}

export function normalizeRunway(rwy: string): string {
    return rwy.trim().toUpperCase()
}

/** True if awosKey matches requested runway or its opposite end. */
export function runwaysMatch(awosKey: string, requested: string): boolean {
    const a = normalizeRunway(awosKey)
    const b = normalizeRunway(requested)
    if (a === b) return true
    return oppositeMap[a] === b
}

export function oppositeOf(rwy: string): string | undefined {
    return oppositeMap[normalizeRunway(rwy)]
}
