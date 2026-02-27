import { Router, Request, Response } from "express"
import axios, { AxiosError } from "axios"

const cdm = Router()

const baseUrl = (process.env.CDM_BASE_URL || "https://cdm-server-production.up.railway.app").replace(
    /\/+$/,
    "",
)
const apiKey = process.env.CDM_API_KEY || ""

cdm.use(async (req: Request, res: Response) => {
    if (!apiKey) {
        res.status(401).send("CDM API key not configured")
        return
    }
    const url = `${baseUrl}${req.path}`
    const headers: Record<string, string> = {}
    headers["x-api-key"] = apiKey

    try {
        const response = await axios({
            method: req.method,
            url,
            params: req.query,
            data: req.body,
            headers,
            validateStatus: () => true,
        })

        res.status(response.status).send(response.data)
    } catch (error: any) {
        if (error instanceof AxiosError && error.response) {
            res.status(error.response.status).send(error.response.data)
            return
        }
        console.error("CDM proxy error", error)
        res.status(500).send("CDM proxy error")
    }
})

export default cdm
