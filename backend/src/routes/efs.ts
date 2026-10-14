import { Router, Request, Response } from "express"

const efs = Router()

/** Freshness window: layout without refresh becomes inactive for Strip TV fallback. */
export const EFS_LAYOUT_TTL_MS = 5 * 60 * 1000

export interface EfsColumn {
    id: string
    callsigns: string[]
}

/** Tower/ops values owned by EFS and mirrored on Strip TV (SEP, DLV, DEP GAP, INFO). */
export interface EfsSepParams {
    sep?: number | string
    dlv?: number | string
    depGap?: number | string
    info?: string
}

export interface EfsLayout {
    source: string
    updatedAt: string
    columns: EfsColumn[]
    /** Separation / tower params from EFS (not derived by IRIS). */
    sep?: EfsSepParams
    airport: string
    view: string
}

const layouts: { [key: string]: EfsLayout } = {}

function layoutKey(airport: string, view: string) {
    return `${airport.toUpperCase()}/${view.toUpperCase()}`
}

function isFresh(layout: EfsLayout): boolean {
    const t = Date.parse(layout.updatedAt)
    if (Number.isNaN(t)) return false
    return Date.now() - t < EFS_LAYOUT_TTL_MS
}

function normalizeBody(airport: string, view: string, body: any): EfsLayout | { error: string } {
    if (!body || typeof body !== "object") {
        return { error: "JSON body required" }
    }
    if (!Array.isArray(body.columns)) {
        return { error: "columns array required" }
    }
    const columns: EfsColumn[] = []
    for (const col of body.columns) {
        if (!col || typeof col.id !== "string") {
            return { error: "each column needs id string" }
        }
        const callsigns = Array.isArray(col.callsigns)
            ? col.callsigns.map((c: any) => String(c).toUpperCase())
            : []
        columns.push({ id: String(col.id), callsigns })
    }

    let sep: EfsSepParams | undefined
    const sepSrc = body.sep && typeof body.sep === "object" ? body.sep : body
    const hasSep =
        sepSrc.sep != null ||
        sepSrc.dlv != null ||
        sepSrc.depGap != null ||
        sepSrc.dep_gap != null ||
        sepSrc.info != null
    if (hasSep) {
        sep = {}
        if (sepSrc.sep != null) sep.sep = sepSrc.sep
        if (sepSrc.dlv != null) sep.dlv = sepSrc.dlv
        if (sepSrc.depGap != null) sep.depGap = sepSrc.depGap
        else if (sepSrc.dep_gap != null) sep.depGap = sepSrc.dep_gap
        if (sepSrc.info != null) sep.info = String(sepSrc.info)
    }

    return {
        source: body.source ? String(body.source) : "efs",
        updatedAt: body.updatedAt ? String(body.updatedAt) : new Date().toISOString(),
        columns,
        sep,
        airport: airport.toUpperCase(),
        view: view.toUpperCase(),
    }
}

/** Publish full bay layout (EFS → IRIS). */
function putLayout(req: Request, res: Response) {
    const airport = String(req.params.airport || "")
    const view = String(req.params.view || "")
    if (!airport || !view) {
        return res.status(400).json({ error: "airport and view required" })
    }
    const normalized = normalizeBody(airport, view, req.body)
    if ("error" in normalized) {
        return res.status(400).json(normalized)
    }
    // Always stamp server time on write so TTL reflects last publish
    normalized.updatedAt = new Date().toISOString()
    const key = layoutKey(airport, view)
    layouts[key] = normalized
    res.json(normalized)
}

efs.put("/:airport/:view", putLayout)
efs.post("/:airport/:view", putLayout)

efs.get("/:airport/:view", (req: Request, res: Response) => {
    const key = layoutKey(String(req.params.airport), String(req.params.view))
    const layout = layouts[key]
    if (!layout) {
        return res.status(404).json({ error: "No EFS layout", efsActive: false })
    }
    if (!isFresh(layout)) {
        return res.status(404).json({
            error: "EFS layout stale",
            efsActive: false,
            updatedAt: layout.updatedAt,
        })
    }
    res.json({ ...layout, efsActive: true })
})

efs.delete("/:airport/:view", (req: Request, res: Response) => {
    const key = layoutKey(String(req.params.airport), String(req.params.view))
    delete layouts[key]
    res.json({ success: true })
})

export default efs
