// AMAN sequence sharing for the ESAA AMAN EuroScope plugin.
//
// The file names follow the MAESTRO convention (MAESTRO_sequence_data_<ICAO>.json), so TopSky can read the
// delays directly by setting AMAN_URL=https://backend.vatiris.se/aman in TopSkySettings.txt.
//
//   GET  /aman/MAESTRO_sequence_data_ESSA.json   latest sequence (404 if none or older than 10 minutes)
//   GET  /aman/ESSA                               same data
//   PUT  /aman/MAESTRO_sequence_data_ESSA.json   upload from the MASTER (HTTP Basic auth, password = AMAN_UPLOAD_PASSWORD)
//   GET  /aman                                    status of all airports (for the VatIRIS frontend)

import { Router, Request, Response } from "express"
import moment from "moment"

const aman = Router()

const MAX_AGE_SECONDS = 600
const MASTER_LOCK_SECONDS = 60

interface StoredSequence {
    data: any
    source: string
    receivedAt: moment.Moment
}

// just storing in memory, like esdata
const sequences: { [icao: string]: StoredSequence } = {}

function icaoFromParam(param: string): string | undefined {
    const m = /^(?:MAESTRO_sequence_data_)?([A-Z]{4})(?:\.json)?$/i.exec(param)
    return m ? m[1].toUpperCase() : undefined
}

function checkAuth(req: Request): boolean {
    const password = process.env.AMAN_UPLOAD_PASSWORD
    if (!password) return true // not configured: open (development)
    const header = req.headers.authorization || ""
    if (!header.startsWith("Basic ")) return false
    const decoded = Buffer.from(header.substring(6), "base64").toString("utf8")
    const sep = decoded.indexOf(":")
    return sep >= 0 && decoded.substring(sep + 1) === password
}

function fresh(s: StoredSequence | undefined): s is StoredSequence {
    return !!s && moment().diff(s.receivedAt, "seconds") <= MAX_AGE_SECONDS
}

aman.get("/", (req: Request, res: Response) => {
    const status: { [icao: string]: any } = {}
    for (const icao in sequences) {
        const s = sequences[icao]
        status[icao] = {
            source: s.source,
            receivedAt: s.receivedAt.toISOString(),
            fresh: fresh(s),
            flights: Array.isArray(s.data?.sequence) ? s.data.sequence.length : 0,
        }
    }
    res.send(status)
})

aman.get("/:file", (req: Request, res: Response) => {
    const icao = icaoFromParam(req.params.file)
    const s = icao ? sequences[icao] : undefined
    if (!fresh(s)) {
        res.status(404).send("Not found")
        return
    }
    res.set("Cache-Control", "no-cache")
    res.send(s.data)
})

const upload = (req: Request, res: Response) => {
    const icao = icaoFromParam(req.params.file)
    if (!icao) {
        res.status(400).send("Invalid file name")
        return
    }
    if (!checkAuth(req)) {
        res.status(401).send("Unauthorized")
        return
    }
    const body = req.body
    if (!body || typeof body !== "object" || !body.data || !Array.isArray(body.sequence)) {
        res.status(400).send("Invalid sequence data")
        return
    }
    if (String(body.data.icao || "").toUpperCase() !== icao) {
        res.status(400).send("Airport mismatch")
        return
    }
    const source = String(body.data.source || "")
    const current = sequences[icao]
    // Only one master at a time: refuse uploads from another source while the current master is active.
    if (current && current.source !== source && moment().diff(current.receivedAt, "seconds") < MASTER_LOCK_SECONDS) {
        res.status(409).send(`Sequence is managed by ${current.source}`)
        return
    }
    sequences[icao] = { data: body, source, receivedAt: moment().utc() }
    res.send("ok")
}

aman.put("/:file", upload)
aman.post("/:file", upload)

export default aman
