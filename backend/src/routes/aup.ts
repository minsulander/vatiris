import { Router, Request, Response } from "express"
import type { UsePlanMode } from "../aup/types"
import { getUsePlan, getAupIds, reloadAupIds } from "../aup/service"

const aup = Router()

function parseMode(req: Request): UsePlanMode {
    return req.query.mode === "all" ? "all" : "sectorfile"
}

function isTruthy(q: unknown): boolean {
    return q === "1" || q === "true"
}

aup.get("/useplan", async (req: Request, res: Response) => {
    try {
        const data = await getUsePlan({
            mode: parseMode(req),
            refreshPdf: isTruthy(req.query.refresh),
            refreshAreas: isTruthy(req.query.refreshAreas),
        })
        res.json(data)
    } catch (e: any) {
        console.error("aup useplan error", e)
        res.status(502).json({ error: e?.message || "Failed to fetch or parse airspace use plan" })
    }
})

aup.get("/useplan/refresh", async (req: Request, res: Response) => {
    try {
        const data = await getUsePlan({
            mode: parseMode(req),
            refreshPdf: true,
            refreshAreas: isTruthy(req.query.refreshAreas),
        })
        res.json(data)
    } catch (e: any) {
        console.error("aup useplan refresh error", e)
        res.status(502).json({ error: e?.message || "Failed to refresh airspace use plan" })
    }
})

aup.get("/useplan/topsky", async (req: Request, res: Response) => {
    try {
        const data = await getUsePlan({
            mode: parseMode(req),
            refreshPdf: isTruthy(req.query.refresh),
            refreshAreas: isTruthy(req.query.refreshAreas),
        })
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
        res.setHeader("Content-Disposition", 'attachment; filename="aup.txt"')
        res.send(data.topsky)
    } catch (e: any) {
        console.error("aup topsky error", e)
        res.status(502).send(e?.message || "Failed to generate TopSky AUP file")
    }
})

async function sendAupText(req: Request, res: Response, mode: UsePlanMode) {
    const data = await getUsePlan({
        mode,
        refreshPdf: isTruthy(req.query.refresh),
        refreshAreas: isTruthy(req.query.refreshAreas),
    })
    res.setHeader("Content-Type", "text/plain; charset=utf-8")
    res.send(data.topsky)
}

/** TopSky requires HTTP_AUP_URL to end with ".txt" (no query string) or it expects JSON. */
aup.get("/aup.txt", async (req: Request, res: Response) => {
    try {
        await sendAupText(req, res, "sectorfile")
    } catch (e: any) {
        console.error("aup aup.txt error", e)
        res.status(502).send(e?.message || "Failed to generate TopSky AUP file")
    }
})

aup.get("/aup-all.txt", async (req: Request, res: Response) => {
    try {
        await sendAupText(req, res, "all")
    } catch (e: any) {
        console.error("aup aup-all.txt error", e)
        res.status(502).send(e?.message || "Failed to generate TopSky AUP file")
    }
})

aup.get("/useplan/aup.txt", async (req: Request, res: Response) => {
    try {
        await sendAupText(req, res, parseMode(req))
    } catch (e: any) {
        console.error("aup useplan aup.txt error", e)
        res.status(502).send(e?.message || "Failed to generate TopSky AUP file")
    }
})

aup.get("/aup-ids", async (req: Request, res: Response) => {
    try {
        if (isTruthy(req.query.refresh)) {
            const data = await reloadAupIds()
            res.json({ ids: data.ids, areasCache: data.areasCache })
            return
        }
        const { ids, areasCache } = await getAupIds()
        res.json({ ids: [...ids].sort(), areasCache })
    } catch (e: any) {
        console.error("aup aup-ids error", e)
        res.status(502).json({ error: e?.message || "Failed to load sector file area ids" })
    }
})

aup.get("/aup-ids/refresh", async (req: Request, res: Response) => {
    try {
        const data = await reloadAupIds()
        res.json({ ids: data.ids, areasCache: data.areasCache })
    } catch (e: any) {
        console.error("aup aup-ids refresh error", e)
        res.status(502).json({ error: e?.message || "Failed to reload sector file area ids" })
    }
})

export default aup
