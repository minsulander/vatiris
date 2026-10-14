import { Router, Request, Response } from "express"
import { getViewId } from "../wx/viewIds"
import { getOps } from "../wx/service"

const wx = Router()

wx.get("/:icao/ops", async (req: Request, res: Response) => {
    try {
        const icao = String(req.params.icao || "").toUpperCase()
        if (!getViewId(icao)) {
            return res.status(404).json({ error: `No AWOS view for ${icao}` })
        }
        const runway = req.query.runway ? String(req.query.runway) : undefined
        const ops = await getOps(icao, runway)
        res.json(ops)
    } catch (e: any) {
        console.error("wx/ops", e)
        const status = e.status || 500
        res.status(status).json({ error: e.message || "failed" })
    }
})

wx.get("/:icao/scc", async (req: Request, res: Response) => {
    try {
        const icao = String(req.params.icao || "").toUpperCase()
        if (!getViewId(icao)) {
            return res.status(404).json({ error: `No AWOS view for ${icao}` })
        }
        const runway = req.query.runway ? String(req.query.runway) : undefined
        const ops = await getOps(icao, runway)
        if (runway) {
            if (!ops.scc) {
                return res.status(404).json({ error: `No SCC for runway ${runway}`, icao })
            }
            return res.json({
                icao: ops.icao,
                observedAt: ops.observedAt,
                runwayInUse: ops.runwayInUse,
                ...ops.scc,
            })
        }
        res.json({
            icao: ops.icao,
            observedAt: ops.observedAt,
            runwayInUse: ops.runwayInUse,
            sccAll: ops.sccAll,
        })
    } catch (e: any) {
        console.error("wx/scc", e)
        const status = e.status || 500
        res.status(status).json({ error: e.message || "failed" })
    }
})

export default wx
