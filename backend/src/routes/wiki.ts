
// Endpoints interacting with the VATSCA wiki
// https://wiki.vatsim-scandinavia.org/api/docs

import { Router, Request, Response } from "express"

import auth from "../auth"
import axios from "axios"

const wikiBaseUrl = "https://wiki.vatsim-scandinavia.org/api"
const wikiToken = process.env.WIKI_TOKEN || ""
const wikiSecret = process.env.WIKI_SECRET || ""
const wikiAxios = axios.create({ headers: { Authorization: `Token ${wikiToken}:${wikiSecret}` } })

const wiki = Router()

let bookIdCache = {} as { [key: string]: number }
let pageIdCache = {} as { [key: string]: number }

wiki.get("/attachment/:id", async (req: Request, res: Response) => {
    if (!await authorize(req, res)) return
    const id = parseInt(req.params.id)
    if (!id) return res.status(400).send("Invalid page ID")
    const response = await wikiAxios.get(`${wikiBaseUrl}/attachments/${id}`)
    const buffer = Buffer.from(response.data.content, "base64")
    const contentType = response.data.extension === "pdf" ? "application/pdf" : "application/octet-stream"
    res.setHeader("Content-Type", contentType)
    res.send(buffer)
})

wiki.get("/pagehtml/:id", async (req: Request, res: Response) => {
    if (!await authorize(req, res)) return
    const id = parseInt(req.params.id)
    if (!id) return res.status(400).send("Invalid page ID")
    // const response = await wikiAxios.get(`${wikiBaseUrl}/pages/${id}/export/html`)
    const response = await wikiAxios.get(`${wikiBaseUrl}/pages/${id}`)
    res.setHeader("Content-Type", "text/html")
    res.send(response.data.html)
})

wiki.get("/book/:book/page/:page/html", async (req: Request, res: Response) => {
    if (!await authorize(req, res)) return
    let bookId = bookIdCache[req.params.book]
    if (!bookId) {
        const booksResponse = await wikiAxios.get(`${wikiBaseUrl}/books`)
        const books = booksResponse.data.data
        const book = books.find((b: any) => b.slug === req.params.book)
        if (!book) return res.status(404).send("Book not found")
        bookId = bookIdCache[req.params.book] = book.id
    }
    let pageId = pageIdCache[`${bookId}-${req.params.page}`]
    if (!pageId) {
        const bookResponse = await wikiAxios.get(`${wikiBaseUrl}/books/${bookId}`)
        const contents = bookResponse.data.contents
        const page = contents.find((p: any) => p.type === "page" && p.slug === req.params.page)
        if (!page) return res.status(404).send("Page not found")
        pageId = pageIdCache[`${bookId}-${req.params.page}`] = page.id
    }
    const pageResponse = await wikiAxios.get(`${wikiBaseUrl}/pages/${pageId}`)
    res.setHeader("Content-Type", "text/html")
    res.send(`<h1 class="page-name">${pageResponse.data.name}</h1>\n${pageResponse.data.html}`)
})

async function authorize(req: Request, res: Response) {
    if (!wikiToken || !wikiSecret) {
        res.status(500).send("Wiki token and secret not set")
        return false
    }
    const cid = await auth.requireCid(req, res)
    if (!cid) return false
    return true
}

export default wiki
