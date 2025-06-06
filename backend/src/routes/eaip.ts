// Just a proxy for aro.lfv.se eAIP
// Doesn't work through API Gateway for some reason... gives "Request Error (unsupported_protocol)"

import { Router, Request, Response } from "express"

import axios, { AxiosError } from "axios"

const eaipBaseUrl = "https://aro.lfv.se/content/eaip"

const eaip = Router()

eaip.get("/*", async (req: Request, res: Response) => {
    const url = `${eaipBaseUrl}/${req.path}`
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
