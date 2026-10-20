import aircraftData from "./data/ICAO_Aircraft.json"

export type EsggPushLetter = "L" | "R" | "N" | "S"

export type EsggPushResult = {
    letter: EsggPushLetter
    /** Hover text explaining the letter */
    title: string
}

type AircraftInfo = {
    wingspan: number | undefined
    isPropeller: boolean
    arc: "A" | "B" | "C" | "D" | "E" | "F" | undefined
}

const aircraftByIcao = new Map<string, any>()
for (const a of aircraftData as any[]) {
    if (a?.ICAO) aircraftByIcao.set(String(a.ICAO).toUpperCase(), a)
}

/** Hyphen spans and slash pairs from the ESGG LOP general list */
const LISTED_PROPS = [
    "AT42",
    "AT72",
    "ATP",
    "DH8A-DH8D",
    "D228",
    "D328",
    "F50",
    "JS31",
    "JS41",
    "SB20",
    "SF34",
    "SW3/SW4",
]

const LISTED_JETS = [
    "C525-C560",
    "CRJ1-CRJ9",
    "EA50",
    "F900",
    "E135/E145",
    "FA7X",
    "GLEX",
    "GLF4/GLF5",
    "H25B",
    "HDJT",
    "J328",
    "LJ31-LJ60",
]

const LISTED_TYPES = [...LISTED_PROPS, ...LISTED_JETS]

const STAND_9_10 = ["CRJ1", "CRJ2", "D228", "D328", "F50", "JS31", "JS41", "SF34", "SW3", "SW4"]

const STAND_46 = [
    "B190",
    "BE190",
    "B350",
    "BE20",
    "BE30",
    "C208",
    "C340",
    "C421",
    "C25A",
    "C525-C560",
    "C55B",
    "C560X",
    "DA42",
    "H25B",
    "JS31",
    "LJ35",
    "LJ45",
    "PC12",
    "PA31",
    "PA34",
    "PA46",
    "PC24",
    "PC6T",
    "SF34",
]

const STAND_48 = [
    "C680",
    "C750",
    "DA42",
    "FA50",
    "F2TH",
    "F900",
    "HA4T",
    "H25B",
    "JS31",
    "LJ35",
    "LJ45",
    "PC12",
    "PA31",
    "PA34",
    "PA46",
    "PC24",
    "PC6T",
    "SF34",
]

/** Stand 40 types that may turn both L and R → no letter */
const STAND_40_BOTH_TURNS = new Set([
    "C560",
    "D228",
    "F900",
    "H25B",
    "JS31",
    "LJ35",
    "LJ45",
    "LJ60",
    "SW4",
])

const STAND_54_EXCLUDED = new Set(["CRJ7", "CRJ9", "D328", "J328"])

function longestCommonPrefix(a: string, b: string): string {
    let i = 0
    const n = Math.min(a.length, b.length)
    while (i < n && a[i] === b[i]) i++
    return a.slice(0, i)
}

function inNumericSpan(value: string, from: string, to: string): boolean {
    const a = parseInt(from, 10)
    const b = parseInt(to, 10)
    const v = parseInt(value, 10)
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(v)) return false
    return v >= Math.min(a, b) && v <= Math.max(a, b)
}

function inLetterSpan(value: string, from: string, to: string): boolean {
    if (value.length !== 1 || from.length !== 1 || to.length !== 1) return false
    const c = value.charCodeAt(0)
    const a = from.charCodeAt(0)
    const b = to.charCodeAt(0)
    return c >= Math.min(a, b) && c <= Math.max(a, b)
}

/** Match ICAO type against a token that may be a code, hyphen span, or slash pair */
export function matchesTypeToken(aircraftType: string, token: string): boolean {
    const type = aircraftType.toUpperCase().trim()
    const t = token.toUpperCase().trim()
    if (!type || !t) return false

    if (t.includes("/")) {
        return t.split("/").some((part) => matchesTypeToken(type, part))
    }

    if (t.includes("-")) {
        const [fromRaw, toRaw] = t.split("-")
        if (!fromRaw || !toRaw) return type === t
        if (type === fromRaw || type === toRaw) return true

        const prefix = longestCommonPrefix(fromRaw, toRaw)
        if (!prefix || !type.startsWith(prefix)) return false

        const fromSuf = fromRaw.slice(prefix.length)
        const toSuf = toRaw.slice(prefix.length)
        const curSuf = type.slice(prefix.length)
        if (!fromSuf || !toSuf || !curSuf) return false

        if (/^\d+$/.test(fromSuf) && /^\d+$/.test(toSuf) && /^\d+$/.test(curSuf)) {
            return inNumericSpan(curSuf, fromSuf, toSuf)
        }
        if (/^[A-Z]+$/.test(fromSuf) && /^[A-Z]+$/.test(toSuf) && /^[A-Z]+$/.test(curSuf)) {
            return inLetterSpan(curSuf, fromSuf, toSuf)
        }
        return false
    }

    return type === t
}

function matchesAnyToken(aircraftType: string, tokens: string[]): boolean {
    return tokens.some((token) => matchesTypeToken(aircraftType, token))
}

function calculateARC(wingspan: number | undefined): AircraftInfo["arc"] {
    if (wingspan == null || Number.isNaN(wingspan)) return undefined
    if (wingspan < 15) return "A"
    if (wingspan < 24) return "B"
    if (wingspan < 36) return "C"
    if (wingspan < 52) return "D"
    if (wingspan < 65) return "E"
    if (wingspan < 80) return "F"
    return undefined
}

export function getAircraftInfo(aircraftType: string | undefined): AircraftInfo | undefined {
    if (!aircraftType) return undefined
    const aircraft = aircraftByIcao.get(aircraftType.toUpperCase().trim())
    if (!aircraft) return undefined
    const wingspan =
        typeof aircraft.Wingspan === "number"
            ? aircraft.Wingspan
            : aircraft.Wingspan != null
              ? parseFloat(aircraft.Wingspan)
              : undefined
    const description = aircraft.Description
    const isPropeller =
        typeof description === "string" && description.length >= 3 && description[2] !== "J"
    return {
        wingspan: Number.isNaN(wingspan as number) ? undefined : wingspan,
        isPropeller,
        arc: calculateARC(wingspan),
    }
}

function isSmallerCodeAB(info: AircraftInfo | undefined): boolean {
    return info?.arc === "A" || info?.arc === "B"
}

/** Listed types, or smaller code A/B aircraft */
function isListedOrSmallerAB(type: string, info: AircraftInfo | undefined): boolean {
    if (matchesAnyToken(type, LISTED_TYPES)) return true
    return isSmallerCodeAB(info)
}

function normalizeStand(stand: string | undefined): string | undefined {
    if (!stand) return undefined
    const s = stand.trim().toUpperCase()
    return s || undefined
}

type PwoOutcome = { approved: boolean; letter?: EsggPushLetter }

/**
 * Whether the type may power out at the stand, and the single-turn letter if limited to one turn.
 * letter is undefined when both turns are allowed (or when not approved).
 */
function powerOutAtStand(
    stand: string,
    type: string | undefined,
    info: AircraftInfo | undefined,
): PwoOutcome {
    // Any-type stands
    if (stand === "1" || stand === "42" || stand === "44") {
        return { approved: true, letter: "S" }
    }
    if (stand === "2") {
        return { approved: true } // both L/R → no letter
    }
    if (stand === "3") {
        return { approved: true, letter: "R" }
    }

    if (!type) {
        // Type-dependent stands need a type
        return { approved: false }
    }

    const t = type.toUpperCase().trim()

    if (stand === "5" || stand === "6" || stand === "7") {
        if (isListedOrSmallerAB(t, info)) return { approved: true } // both turns
        return { approved: false }
    }

    if (stand === "5A") {
        if (t === "C130") return { approved: true } // both turns
        return { approved: false }
    }

    if (stand === "7A") {
        if (t === "C130") return { approved: true, letter: "L" }
        return { approved: false }
    }

    if (stand === "9" || stand === "10") {
        if (matchesAnyToken(t, STAND_9_10)) return { approved: true } // both turns
        return { approved: false }
    }

    if (stand === "30") {
        if (isListedOrSmallerAB(t, info) || matchesAnyToken(t, ["AT45", "CRJX", "GL7T"])) {
            return { approved: true, letter: "R" }
        }
        return { approved: false }
    }

    if (stand === "32") {
        if (isListedOrSmallerAB(t, info) || matchesTypeToken(t, "AT45")) {
            return { approved: true } // both turns
        }
        return { approved: false }
    }

    if (stand === "34" || stand === "36" || stand === "38") {
        if (isListedOrSmallerAB(t, info) || t === "AN26") return { approved: true }
        return { approved: false }
    }

    if (stand === "40") {
        const approved =
            isListedOrSmallerAB(t, info) || t === "AN26" || matchesTypeToken(t, "AT45")
        if (!approved) return { approved: false }
        if (STAND_40_BOTH_TURNS.has(t)) return { approved: true } // both → no letter
        return { approved: true, letter: "L" }
    }

    if (stand === "46") {
        if (matchesAnyToken(t, STAND_46)) return { approved: true, letter: "L" }
        return { approved: false }
    }

    if (stand === "48") {
        if (matchesAnyToken(t, STAND_48)) return { approved: true, letter: "L" }
        return { approved: false }
    }

    if (stand === "54") {
        if (STAND_54_EXCLUDED.has(t)) return { approved: false }
        const under15 = info?.wingspan != null && info.wingspan < 15
        const listedCodeB =
            matchesAnyToken(t, LISTED_TYPES) && (info?.arc === "A" || info?.arc === "B")
        if (t === "SF34" || listedCodeB || under15) {
            return { approved: true, letter: "L" }
        }
        return { approved: false }
    }

    if (
        stand === "56" ||
        stand === "58" ||
        stand === "60" ||
        stand === "62"
    ) {
        const propAB = info?.isPropeller && isSmallerCodeAB(info)
        const jetA = info && !info.isPropeller && info.arc === "A"
        const named = matchesAnyToken(t, ["AT42", "C550", "C56X", "C650", "SF34"])
        if (propAB || jetA || named) return { approved: true, letter: "L" }
        return { approved: false }
    }

    if (stand === "70" || stand === "72" || stand === "74") {
        if (isListedOrSmallerAB(t, info) || matchesAnyToken(t, ["AT45", "CRJX", "GL7T"])) {
            return { approved: true } // both turns
        }
        return { approved: false }
    }

    if (stand === "76" || stand === "78") {
        if (
            isListedOrSmallerAB(t, info) ||
            matchesAnyToken(t, ["AN26", "AT45", "ATP"])
        ) {
            return { approved: true } // both turns
        }
        return { approved: false }
    }

    return { approved: false }
}

function oneWayPushLetter(
    stand: string,
    type: string | undefined,
    info: AircraftInfo | undefined,
): EsggPushLetter | undefined {
    // N: 5, 5A, 68, stand 21 when code D/E
    if (stand === "5" || stand === "5A" || stand === "68") return "N"

    if (stand === "21") {
        if (!info?.arc) return undefined
        if (info.arc === "D" || info.arc === "E") return "N"
        return undefined
    }

    // S: 23B, 41, 41A
    if (stand === "23B" || stand === "41" || stand === "41A") return "S"

    return undefined
}

function titleForLetter(letter: EsggPushLetter, kind: "pwo" | "push"): string {
    if (kind === "pwo") {
        if (letter === "S") return "Power-out straight"
        if (letter === "L") return "Power-out left"
        if (letter === "R") return "Power-out right"
    }
    if (letter === "N") return "Pushback facing north"
    if (letter === "S") return "Pushback facing south"
    if (letter === "L") return "Power-out left"
    if (letter === "R") return "Power-out right"
    return ""
}

/**
 * ESGG departure direction letter for flight list.
 * Only returns a letter when the stand+type is limited to one power-out turn or one push direction.
 */
export function getEsggPushLetter(
    stand: string | undefined,
    aircraftType: string | undefined,
): EsggPushResult | undefined {
    const s = normalizeStand(stand)
    if (!s) return undefined

    const type = aircraftType?.trim() ? aircraftType.trim().toUpperCase() : undefined
    const info = getAircraftInfo(type)

    // Stands that show a letter without needing type (any-type single direction, or one-way push with no PWO)
    const pwo = powerOutAtStand(s, type, info)

    if (pwo.approved) {
        if (pwo.letter) {
            return { letter: pwo.letter, title: titleForLetter(pwo.letter, "pwo") }
        }
        // Both turns allowed → no letter
        return undefined
    }

    // Not approved for power-out → one-way push letter if applicable
    // Stands that always show push letter even without type: 5A, 68, 23B, 41, 41A
    // (5A only when not C130 PWO — already handled)
    const pushAlwaysWithoutType =
        s === "5A" || s === "68" || s === "23B" || s === "41" || s === "41A"

    if (!type && !pushAlwaysWithoutType && s !== "5") {
        // Stand 5 needs type for PWO decision; without type treat as push N (one-way)
        // Actually plan: "5A, 68, 23B, 41 and 41A show the push letter even when the type is missing"
        // Stand 5 without type: letter depends on type for PWO — without type, cannot know if PWO.
        // Plan: "unknown type when the letter depends on type: no letter"
        // For stand 5, if we don't know type we don't know if listed → no letter
        return undefined
    }

    if (!type && (s === "5" || s === "21" || s === "7A")) {
        return undefined
    }

    const push = oneWayPushLetter(s, type, info)
    if (push) {
        return { letter: push, title: titleForLetter(push, "push") }
    }

    return undefined
}
