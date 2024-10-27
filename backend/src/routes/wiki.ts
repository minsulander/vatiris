import { Router, Request, Response } from "express"

import auth from "../auth"
import axios from "axios"

const wikiBaseUrl = "https://wiki.vatsim-scandinavia.org/api"
const wikiToken = process.env.WIKI_TOKEN || ""
const wikiSecret = process.env.WIKI_SECRET || ""
const wikiAxios = axios.create({ headers: { Authorization: `Token ${wikiToken}:${wikiSecret}` } })

const wiki = Router()

wiki.get("/attachment/:id", async (req: Request, res: Response) => {
    if (!wikiToken || !wikiSecret) {
        res.status(500).send("Wiki token and secret not set")
        return
    }
    const id = parseInt(req.params.id)
    if (!id) {
        console.error("Invalid attachment ID", req.params.id)
        res.status(400).send("Invalid attachment ID")
        return
    }
    const cid = await auth.requireCid(req, res)
    if (!cid) return
    const response = await wikiAxios.get(`${wikiBaseUrl}/attachments/${id}`)
    const buffer = Buffer.from(response.data.content, "base64")
    const contentType = response.data.extension === "pdf" ? "application/pdf" : "application/octet-stream"
    res.setHeader("Content-Type", contentType)
    res.send(buffer)
})

wiki.get("/pagehtml/:id", async (req: Request, res: Response) => {
    if (!wikiToken || !wikiSecret) {
        res.status(500).send("Wiki token and secret not set")
        return
    }
    const id = parseInt(req.params.id)
    if (!id) {
        console.error("Invalid page ID", req.params.id)
        res.status(400).send("Invalid page ID")
        return
    }
    const cid = await auth.requireCid(req, res)
    if (!cid) return
    // const response = await wikiAxios.get(`${wikiBaseUrl}/pages/${req.params.id}/export/html`)
    const response = await wikiAxios.get(`${wikiBaseUrl}/pages/${req.params.id}`)
    res.setHeader("Content-Type", "text/html")
    res.send(response.data.html)
})

export default wiki
