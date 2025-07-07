import { Router, Request, Response } from "express"
import axios, { AxiosError } from "axios"
import { crawlAIP } from "../eaip-crawler"

const eaipBaseUrl = "https://aro.lfv.se/content/eaip"

const eaip = Router()

let eaipIndex = {} as any
let eaipIndexTimestamp = 0

eaip.all("/crawl", async (req: Request, res: Response) => {
    try {
        eaipIndex = await crawlAIP()
        eaipIndexTimestamp = Date.now()
        res.json(eaipIndex)
    } catch (e: any) {
        console.error("eaip crawl error", e)
        if (e instanceof AxiosError) {
            res.status(e.response?.status || 500).send(e.message)
        } else {
            res.status(500).send("Internal Server Error")
        }
    }
})

eaip.get("/index", async (req: Request, res: Response) => {
    if (Object.keys(eaipIndex).length === 0 || Date.now() - eaipIndexTimestamp > 24 * 60 * 60 * 1000) {
        try {
            const aipIndex = await crawlAIP()
            eaipIndex = aipIndex
            eaipIndexTimestamp = Date.now()
        } catch (e: any) {
            console.error("eaip crawl error", e)
        }
    }
    res.json(eaipIndex)
})

// Just a proxy for aro.lfv.se eAIP
// Doesn't work through API Gateway for some reason... gives "Request Error (unsupported_protocol)"

eaip.get("/content/*", async (req: Request, res: Response) => {
    const url = `${eaipBaseUrl}/${req.path.replace(/^\/content\//, "")}`
    try {
        const response = await axios.get(url, { responseType: "arraybuffer" })
        //console.log(`eaip ${url} ${response.data.length}`)
        for (const header in response.headers) {
            res.setHeader(header, response.headers[header])
            //console.log(`  ${header}: ${response.headers[header]}`)
        }
        res.send(Buffer.from(response.data, "binary"))
    } catch (e: any) {
        console.error("eaip error", e.status)
        res.status(e.status).send("oh no")
    }
})

export default eaip
