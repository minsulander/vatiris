import { Router, Request, Response } from "express"
import auth from "../auth"
import * as aup from "../services/aup"
import * as merge from "../services/aup-merge"
import * as db from "../db"

const TOPsky_FIR = process.env.TOPsky_FIR || "esaa"
const router = Router()

router.get("/topsky/merged", async (req: Request, res: Response) => {
    try {
        const text = await merge.getMergedTopSky()
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
        res.setHeader("Cache-Control", "public, max-age=300")
        res.send(text)
    } catch (err) {
        console.error("[AUP] topsky/merged error:", err)
        res.status(500).send("Failed to fetch merged TopSky feed")
    }
})

router.get("/aup/activations", async (req: Request, res: Response) => {
    try {
        const data = await merge.getActivations()
        res.json(data)
    } catch (err) {
        console.error("[AUP] activations error:", err)
        res.status(500).json({ lara: [], lfv: [] })
    }
})

router.get("/aup/overrides", async (req: Request, res: Response) => {
    try {
        const overrides = await db.getAupOverrides(TOPsky_FIR)
        res.json(overrides)
    } catch (err) {
        console.error("[AUP] overrides get error:", err)
        res.status(500).json({})
    }
})

router.put("/aup/overrides", async (req: Request, res: Response) => {
    const cid = await auth.requireCid(req, res)
    if (!cid) return

    const body = req.body as Record<string, boolean>
    if (!body || typeof body !== "object") {
        res.status(400).send("Expected JSON object of area -> active")
        return
    }

    try {
        await db.setAupOverrides(TOPsky_FIR, body)
        res.json(body)
    } catch (err) {
        console.error("[AUP] overrides put error:", err)
        res.status(500).send("Failed to save overrides")
    }
})

router.post("/aup/overrides/:area", async (req: Request, res: Response) => {
    const cid = await auth.requireCid(req, res)
    if (!cid) return

    const area = req.params.area
    const active = req.body?.active !== false

    try {
        await db.setAupOverride(TOPsky_FIR, area, active)
        const overrides = await db.getAupOverrides(TOPsky_FIR)
        res.json(overrides)
    } catch (err) {
        console.error("[AUP] override set error:", err)
        res.status(500).send("Failed to set override")
    }
})

router.get("/aup/lfv", async (req: Request, res: Response) => {
    try {
        const result = await aup.fetchLfvAup()
        res.json({
            restrictions: aup.getRestrictionsJson(result.restrictions),
            pdfDate: result.pdfDate,
            fetchedAt: new Date(result.fetchedAt).toISOString(),
        })
    } catch (err) {
        console.error("[AUP] lfv error:", err)
        res.status(500).json({ restrictions: [], error: (err as Error).message })
    }
})

router.get("/aup/vlara", async (req: Request, res: Response) => {
    const vlaraBase = process.env.VLARA_BACKEND_URL || "https://lara-backend.lusep.fi"
    const vlaraUrl = `${vlaraBase}/topsky/${TOPsky_FIR}.txt`
    try {
        const axios = (await import("axios")).default
        const { data } = await axios.get(vlaraUrl, { timeout: 10000 })
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
        res.send(data)
    } catch (err) {
        console.error("[AUP] vlara error:", err)
        res.status(500).send("Failed to fetch vLARA feed")
    }
})

export default router
