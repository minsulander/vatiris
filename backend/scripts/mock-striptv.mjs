/**
 * Seed local IRIS with mock ESSA/ESGG strip traffic for Strip TV look tweaking.
 * Usage: node scripts/mock-striptv.mjs
 */
const BASE = process.env.BACKEND_URL || "http://localhost:5172"

async function put(path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`)
    return res.json()
}

async function post(path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`${path} ${res.status} ${text}`)
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

const sidsW = ["300·040·TOVRI", "BABAP4C", "NOSLI5C", "TOVRI5C", "240·ARS", "RESNA3C", "DUNKA4C", "TRS5C"]
const sidsE = ["TOVRI4B", "RESNA3B", "VFR·NORTH", "ARS3B·KOGAV", "BABAP3B", "NOSLI4B", "120·BABAP", "PETEV2B"]
const types = [
    ["B763", "H"],
    ["A20N", "M"],
    ["A321", "M"],
    ["B738", "M"],
    ["B38M", "M"],
    ["A359", "H"],
    ["E190", "M"],
    ["B789", "H"],
    ["AT76", "M"],
    ["CRJ9", "M"],
]

/** Hand-picked head of sequence (first = bottom of bay). */
const flights = [
    { cs: "UPS292", gs: "LINEUP", rwy: "01L", sid: "300·040·TOVRI", type: "B763", wtc: "H", stand: "F33", cleared: true, cfto: true, atd: "0301", cfl: 5000 },
    { cs: "SAS912", gs: "TAXI", rwy: "01L", sid: "BABAP4C", type: "A20N", wtc: "M", stand: "F12", cleared: true, cfl: 5000 },
    { cs: "DLH805", gs: "LINEUP", rwy: "08", sid: "NOSLI5C", type: "A321", wtc: "M", stand: "F08", cleared: false },
    { cs: "RYR45KJ", gs: "DEPA", rwy: "01R", sid: "TOVRI4B", type: "B738", wtc: "M", stand: "F41", cleared: true, cfto: true, atd: "2148", cfl: 7000 },
    { cs: "NAX4412", gs: "LINEUP", rwy: "01R", sid: "RESNA3B", type: "B38M", wtc: "M", stand: "F22", cleared: true, cfto: true, cfl: 5000 },
    { cs: "FIN618", gs: "DEPA", rwy: "01L", sid: "240·ARS", type: "A359", wtc: "H", stand: "F02", cleared: true, atd: "2145", cfl: 5000 },
    { cs: "KLM1123", gs: "TAXI", rwy: "01R", sid: "VFR·NORTH", type: "E190", wtc: "M", stand: "F18", cleared: true, fr: "V" },
    { cs: "BAW777", gs: "TAXI", rwy: "01R", sid: "ARS3B·KOGAV", type: "B789", wtc: "H", stand: "F05", cleared: true, cfl: 5000 },
]

// Bulk traffic so each bay overflows (scroll pin test)
const airlines = ["SAS", "NAX", "RYR", "DLH", "BAW", "AFL", "THY", "EIN", "LOT", "WZZ", "EZY", "IBE", "AFR", "KLM", "FIN"]
for (let i = 0; i < 48; i++) {
    const west = i % 2 === 0
    const rwy = west ? (i % 10 === 8 ? "08" : "01L") : "01R"
    const sids = west ? sidsW : sidsE
    const [type, wtc] = types[i % types.length]
    const gs = i % 5 === 0 ? "DEPA" : i % 3 === 0 ? "LINEUP" : "TAXI"
    const cs = `${airlines[i % airlines.length]}${String(1000 + i)}`
    flights.push({
        cs,
        gs,
        rwy,
        sid: sids[i % sids.length],
        type,
        wtc,
        stand: `F${String((i % 40) + 1).padStart(2, "0")}`,
        cleared: i % 7 !== 0,
        cfto: gs === "DEPA" || i % 11 === 0,
        atd: gs === "DEPA" ? String(2100 + (i % 60)).padStart(4, "0") : undefined,
        cfl: i % 4 === 0 ? 7000 : 5000,
        fr: i % 13 === 0 ? "V" : "I",
    })
}

const esBody = {}
for (const f of flights) {
    esBody[f.cs] = {
        groundstate: f.gs,
        depRwy: f.rwy,
        sid: f.sid,
        stand: f.stand,
        aircraft: f.type,
        wtc: f.wtc,
        flightRules: f.fr || "I",
        clearence: f.cleared !== false,
        clearedForTakeoff: !!f.cfto || f.gs === "DEPA",
        atd: f.atd,
        cfl: f.cfl,
    }
}

const twrW = flights.filter((f) => f.rwy === "01L" || f.rwy === "08").map((f) => f.cs)
const twrE = flights.filter((f) => f.rwy === "01R").map((f) => f.cs)

const paper = {
    PA_TAXI: flights.filter((f) => f.gs === "TAXI").slice(0, 20).map((f) => f.cs),
    PA_BANAN: flights.filter((f) => f.gs === "LINEUP").slice(0, 16).map((f) => f.cs),
    UTFLYGNING: flights.filter((f) => f.gs === "DEPA").slice(0, 12).map((f) => f.cs),
}

/** EFS layout TTL is 5 min — refresh often enough to stay active. */
const KEEP_ALIVE_MS = Number(process.env.MOCK_INTERVAL_MS) || 90_000
const once = process.argv.includes("--once")

async function seed() {
    await post("/esdata", esBody)
    await put("/efs/ESSA/DEP", {
        source: "mock",
        sep: { sep: "2.5", dlv: "2.5", depGap: "", info: "" },
        columns: [
            { id: "TWR-W", callsigns: twrW },
            { id: "TWR-E", callsigns: twrE },
        ],
    })
    await put("/efs/ESGG/DEP", {
        source: "mock",
        sep: { sep: "3", dlv: "2.5", depGap: "6", info: "" },
        columns: [
            { id: "PA_TAXI", callsigns: paper.PA_TAXI },
            { id: "PA_BANAN", callsigns: paper.PA_BANAN },
            { id: "UTFLYGNING", callsigns: paper.UTFLYGNING },
        ],
    })
}

console.log("Seeding mock Strip TV traffic…")
await seed()
console.log("OK — open Flight → STRIP TV ESSA / STRIP TV ESGG")
console.log(`Callsigns: ${flights.length} total (TWR-W ${twrW.length}, TWR-E ${twrE.length})`)
console.log("First W:", twrW[0], "First E:", twrE[0])

if (!once) {
    console.log(`Keep-alive every ${KEEP_ALIVE_MS / 1000}s (Ctrl+C to stop, or --once)`)
    setInterval(() => {
        seed().catch((err) => console.error("Reseed failed:", err.message || err))
    }, KEEP_ALIVE_MS)
}
