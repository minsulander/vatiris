import { Router, Request, Response } from "express"
import { AirportMeta, EFS_REALMS, EfsRealm } from "../efs-sync/types"
import * as store from "../efs-sync/store"

const efsSync = Router()

const RESERVED = new Set(["order", "meta", "heartbeat", "ws", "sep", "strips", "stream"])

function parseRealm(raw: string): EfsRealm | undefined {
    const r = String(raw || "").toLowerCase() as EfsRealm
    return EFS_REALMS.includes(r) ? r : undefined
}

function parseAirport(raw: string): string | undefined {
    const a = String(raw || "").toUpperCase()
    return /^[A-Z]{4}$/.test(a) ? a : undefined
}

/** Write auth: X-Vatsim-Cid. Optional allowlist via EFS_SYNC_ALLOW_CIDS (comma-separated). */
export function requireWriteCid(req: Request, res: Response): number | undefined {
    const header = req.headers["x-vatsim-cid"]
    const raw = Array.isArray(header) ? header[0] : header
    const cid = Number(raw)
    if (!raw || !Number.isFinite(cid) || cid <= 0) {
        res.status(401).json({ error: "X-Vatsim-Cid required" })
        return undefined
    }
    const allow = (process.env.EFS_SYNC_ALLOW_CIDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    if (allow.length && !allow.includes(String(cid))) {
        res.status(403).json({ error: "CID not allowlisted for EFS sync write" })
        return undefined
    }
    return cid
}

function params(req: Request, res: Response): { realm: EfsRealm; airport: string } | undefined {
    const realm = parseRealm(String(req.params.realm || ""))
    const airport = parseAirport(String(req.params.airport || ""))
    if (!realm || !airport) {
        res.status(400).json({ error: "realm and 4-letter airport required" })
        return undefined
    }
    return { realm, airport }
}

/** Flat fields plus `meta` so late joiners can read either envelope. */
function metaBody(meta: AirportMeta) {
    const payload = store.publicAirportMeta(meta)
    return {
        ...payload,
        updatedAt: meta.updatedAt,
        updatedByCid: meta.updatedByCid ?? null,
        meta: payload,
    }
}

/** GET full snapshot */
efsSync.get("/:realm/:airport", (req, res) => {
    const p = params(req, res)
    if (!p) return
    res.json(store.snapshot(p.realm, p.airport))
})

efsSync.put("/:realm/:airport/order", (req, res) => {
    const p = params(req, res)
    if (!p) return
    const cid = requireWriteCid(req, res)
    if (cid === undefined) return
    const result = store.putOrder(p.realm, p.airport, req.body || {}, cid)
    if ("error" in result) return res.status(400).json(result)
    res.json(result)
})

efsSync.get("/:realm/:airport/order", (req, res) => {
    const p = params(req, res)
    if (!p) return
    const order = store.getOrder(p.realm, p.airport)
    if (!order) return res.status(404).json({ error: "No order" })
    res.json(order)
})

efsSync.put("/:realm/:airport/meta", (req, res) => {
    const p = params(req, res)
    if (!p) return
    const cid = requireWriteCid(req, res)
    if (cid === undefined) return
    const result = store.putMeta(p.realm, p.airport, req.body || {}, cid)
    if ("error" in result) return res.status(400).json(result)
    res.json(metaBody(result))
})

efsSync.get("/:realm/:airport/meta", (req, res) => {
    const p = params(req, res)
    if (!p) return
    const meta = store.getMeta(p.realm, p.airport)
    if (!meta) return res.status(404).json({ error: "No meta" })
    res.json(metaBody(meta))
})

efsSync.put("/:realm/:airport/heartbeat", (req, res) => {
    const p = params(req, res)
    if (!p) return
    const cid = requireWriteCid(req, res)
    if (cid === undefined) return
    res.json(store.heartbeat(p.realm, p.airport, cid))
})

/** Bare strip key — must be after reserved routes */
efsSync.put("/:realm/:airport/:stripKey", (req, res) => {
    const p = params(req, res)
    if (!p) return
    const stripKey = String(req.params.stripKey || "")
    if (!stripKey || RESERVED.has(stripKey.toLowerCase())) {
        return res.status(400).json({ error: "invalid stripKey" })
    }
    const cid = requireWriteCid(req, res)
    if (cid === undefined) return
    const result = store.putStrip(p.realm, p.airport, stripKey, req.body || {}, cid)
    if ("error" in result) return res.status(400).json(result)
    res.json(result)
})

efsSync.get("/:realm/:airport/:stripKey", (req, res) => {
    const p = params(req, res)
    if (!p) return
    const stripKey = String(req.params.stripKey || "")
    if (!stripKey || RESERVED.has(stripKey.toLowerCase())) {
        return res.status(400).json({ error: "invalid stripKey" })
    }
    const rec = store.getStrip(p.realm, p.airport, stripKey)
    if (!rec) return res.status(404).json({ error: "No strip" })
    res.json(rec)
})

efsSync.delete("/:realm/:airport/:stripKey", (req, res) => {
    const p = params(req, res)
    if (!p) return
    const stripKey = String(req.params.stripKey || "")
    if (!stripKey || RESERVED.has(stripKey.toLowerCase())) {
        return res.status(400).json({ error: "invalid stripKey" })
    }
    const cid = requireWriteCid(req, res)
    if (cid === undefined) return
    const result = store.deleteStrip(p.realm, p.airport, stripKey, cid)
    if ("error" in result) return res.status(400).json(result)
    res.json({ success: true })
})

export default efsSync
export { parseRealm, parseAirport }
