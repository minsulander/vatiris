import { Router, Request, Response } from "express"
import { AxiosError } from "axios"
import { getBulletin, getBulletinPdf, getIndex, parseProfile } from "../notam/service"

const notam = Router()

function sendError(res: Response, e: unknown) {
    console.error("notam error", e)
    if (e instanceof AxiosError) res.status(502).send(`LFV request failed: ${e.message}`)
    else res.status(500).send("Internal Server Error")
}

notam.get("/", async (req: Request, res: Response) => {
    try {
        res.json(await getIndex())
    } catch (e) {
        sendError(res, e)
    }
})

/** Parsed LFV Pre-Flight Information Bulletin for a profile: IFR, VFR or HKP */
notam.get("/:profile", async (req: Request, res: Response) => {
    const profile = parseProfile(req.params.profile)
    if (!profile) {
        res.status(404).send("Unknown NOTAM profile, use IFR, VFR or HKP")
        return
    }
    try {
        res.json(await getBulletin(profile))
    } catch (e) {
        sendError(res, e)
    }
})

/**
 * Source PDF for a profile, proxied since LFV doesn't allow cross-origin requests.
 * The filename is the publication time; whatever bulletin is current is served.
 */
notam.get("/:profile/:published.pdf", async (req: Request, res: Response) => {
    const profile = parseProfile(req.params.profile)
    if (!profile) {
        res.status(404).send("Unknown NOTAM profile, use IFR, VFR or HKP")
        return
    }
    try {
        const { bulletin, buffer } = await getBulletinPdf(profile)
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="ESAA FIR ${profile} 24hr.pdf"`)
        if (bulletin.pdfPath.endsWith(`/${req.params.published}.pdf`)) {
            res.setHeader("Cache-Control", "public, max-age=86400, immutable")
        }
        res.send(buffer)
    } catch (e) {
        sendError(res, e)
    }
})

export default notam
