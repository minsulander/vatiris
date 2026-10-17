import { runwaysMatch, normalizeRunway } from "./oppositeRunways"

export interface SccEntry {
    runway: string
    matchedKey: string
    closed: boolean
    thirds: number[] | null
    issuedAt: string | null
    remark: string | null
    raw: string
}

const rwyLineRe = /^(\d{2}[LRC]?):\s*(.*)$/i
const sccRe = /^SCC\s+(\d+)\s+(\d+)\s+(\d+)\s*(?:ISSUED AT\s+(\d{4}))?\s*(.*)$/i

/** Parse AWOS info block text into per-runway SCC entries (stops before SIG/TAF noise is fine — runway lines only). */
export function parseSccFromInfo(infoText: string): SccEntry[] {
    const entries: SccEntry[] = []
    if (!infoText) return entries

    for (const line of infoText.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const m = trimmed.match(rwyLineRe)
        if (!m) continue

        const matchedKey = normalizeRunway(m[1])
        const rest = m[2].trim()

        if (/^CLOSED\b/i.test(rest)) {
            entries.push({
                runway: matchedKey,
                matchedKey,
                closed: true,
                thirds: null,
                issuedAt: null,
                remark: "CLOSED",
                raw: rest,
            })
            continue
        }

        const scc = rest.match(sccRe)
        if (scc) {
            const remark = (scc[5] || "").trim() || null
            entries.push({
                runway: matchedKey,
                matchedKey,
                closed: false,
                thirds: [parseInt(scc[1], 10), parseInt(scc[2], 10), parseInt(scc[3], 10)],
                issuedAt: scc[4] || null,
                remark,
                raw: rest,
            })
        } else {
            entries.push({
                runway: matchedKey,
                matchedKey,
                closed: false,
                thirds: null,
                issuedAt: null,
                remark: rest || null,
                raw: rest,
            })
        }
    }
    return entries
}

export function findSccForRunway(entries: SccEntry[], runway: string): SccEntry | undefined {
    const req = normalizeRunway(runway)
    return entries.find((e) => runwaysMatch(e.matchedKey, req))
}
