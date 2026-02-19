/**
 * Merge vLARA remote feed + LFV AUP (with overrides) into TopSky format.
 */
import axios from "axios"
import * as aup from "./aup"
import * as db from "../db"

const VLARA_BACKEND_URL = process.env.VLARA_BACKEND_URL || "https://lara-backend.lusep.fi"
const TOPsky_FIR = process.env.TOPsky_FIR || "esaa"
const MERGE_CACHE_TTL_MS =
    (parseInt(process.env.AUP_CACHE_TTL_MINUTES || "5", 10) || 5) * 60 * 1000

let mergeCache: { text: string; fetchedAt: number } | null = null

function parseVlaraLines(text: string): string[] {
    return text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
}

export async function getMergedTopSky(): Promise<string> {
    if (mergeCache && Date.now() - mergeCache.fetchedAt < MERGE_CACHE_TTL_MS) {
        return mergeCache.text
    }

    const vlaraUrl = `${VLARA_BACKEND_URL}/topsky/${TOPsky_FIR}.txt`
    let vlaraLines: string[] = []
    try {
        const { data } = await axios.get(vlaraUrl, { timeout: 10000 })
        vlaraLines = parseVlaraLines(data)
    } catch (err) {
        console.warn("[AUP] Failed to fetch vLARA feed:", (err as Error).message)
        vlaraLines = ["VLARA:350101:350101:0:1000:1001:0:100:VLARA:"]
    }

    let lfvLines: string[] = []
    let overrides: Record<string, boolean> = {}
    try {
        const [aupResult, overridesData] = await Promise.all([
            aup.fetchLfvAup(),
            db.getAupOverrides(TOPsky_FIR),
        ])
        overrides = overridesData
        const lfvRestrictions = aup.restrictionsToTopSky(aupResult.restrictions)
        for (const line of lfvRestrictions) {
            const name = line.split(":")[0]
            const override = overrides[name]
            if (override === undefined) {
                lfvLines.push(line)
            } else if (override) {
                lfvLines.push(line)
            }
        }
    } catch (err) {
        console.warn("[AUP] Failed to fetch LFV AUP:", (err as Error).message)
    }

    const vlaraDataLines = vlaraLines.filter((l) => l.includes(":") && !l.startsWith("REFRESH_"))
    const hasVlaraDummy = vlaraDataLines.some((l) => l.startsWith("VLARA:"))

    let out = "REFRESH_INTERVAL:45\n"
    if (vlaraDataLines.length > 0) {
        out += vlaraDataLines.join("\n") + "\n"
    } else {
        out += "VLARA:350101:350101:0:1000:1001:0:100:VLARA:\n"
    }
    out += lfvLines.join("\n")
    if (lfvLines.length > 0) out += "\n"
    out = out.trimEnd()

    mergeCache = { text: out, fetchedAt: Date.now() }
    return out
}

export interface ActivationItem {
    name: string
    active: boolean
    from: string
    to: string
    fl: string
    overridden?: boolean
}

export interface ActivationsResponse {
    lara: ActivationItem[]
    lfv: ActivationItem[]
}

export async function getActivations(): Promise<ActivationsResponse> {
    const vlaraUrl = `${VLARA_BACKEND_URL}/topsky/${TOPsky_FIR}.txt`
    let laraItems: ActivationItem[] = []
    try {
        const { data } = await axios.get(vlaraUrl, { timeout: 10000 })
        const lines = parseVlaraLines(data).filter(
            (l) => l.includes(":") && !l.startsWith("REFRESH_") && l.split(":")[0] !== "VLARA"
        )
        laraItems = lines.map((l) => {
            const parts = l.split(":")
            return {
                name: parts[0] || "",
                active: true,
                from: parts[4] ? `${parts[4].slice(0, 2)}:${parts[4].slice(2)}` : "",
                to: parts[5] ? `${parts[5].slice(0, 2)}:${parts[5].slice(2)}` : "",
                fl: parts[7] || "",
                overridden: false,
            }
        })
        if (laraItems.length === 0) {
            const vlaraLine = parseVlaraLines(data).find((l) => l.startsWith("VLARA:"))
            if (vlaraLine) {
                const p = vlaraLine.split(":")
                laraItems = [
                    {
                        name: "VLARA",
                        active: true,
                        from: "",
                        to: "",
                        fl: p[7] || "",
                        overridden: false,
                    },
                ]
            }
        }
    } catch {
        laraItems = []
    }

    let lfvItems: ActivationItem[] = []
    let overrides: Record<string, boolean> = {}
    try {
        const [aupResult, overridesData] = await Promise.all([
            aup.fetchLfvAup(),
            db.getAupOverrides(TOPsky_FIR),
        ])
        overrides = overridesData
        lfvItems = aup.getRestrictionsJson(aupResult.restrictions).map((r) => ({
            ...r,
            overridden: r.name in overrides,
            active: r.name in overrides ? overrides[r.name] : true,
        }))
    } catch {
        lfvItems = []
    }

    return { lara: laraItems, lfv: lfvItems }
}
