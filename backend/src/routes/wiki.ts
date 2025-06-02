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
    if (!(await authorize(req, res))) return
    const id = parseInt(req.params.id)
    if (!id) return res.status(400).send("Invalid page ID")
    const response = await wikiAxios.get(`${wikiBaseUrl}/attachments/${id}`)
    const buffer = Buffer.from(response.data.content, "base64")
    const contentType = response.data.extension === "pdf" ? "application/pdf" : "application/octet-stream"
    res.setHeader("Content-Type", contentType)
    res.send(buffer)
})

wiki.get("/book/:book/page/:page", async (req: Request, res: Response) => {
    if (!(await authorize(req, res))) return
    try {
        const page = await getPage(req.params.book, req.params.page)
        res.json({
            name: page.name,
            html: page.html,
            revision: page.revision_count,
            updatedTime: page.updated_at || page.created_at,
            updatedBy: page.updated_by ? page.updated_by.name : page.created_by ? page.created_by.name : "Unknown",
        })
    } catch (e) {
        const str = `${e}`
        if (str.toLowerCase().includes("not found")) return res.status(404).send(str)
        return res.status(500).send(str)
    }
})

wiki.get("/book/:book/page/:page/html", async (req: Request, res: Response) => {
    if (!(await authorize(req, res))) return
    try {
        const page = await getPage(req.params.book, req.params.page)
        res.setHeader("Content-Type", "text/html")
        res.send(`<h1 class="page-name">${page.name}</h1>\n${page.html}`)
    } catch (e) {
        const str = `${e}`
        if (str.toLowerCase().includes("not found")) return res.status(404).send(str)
        return res.status(500).send(str)
    }
})

async function getPage(bookName: string, pageName: string) {
    let bookId = bookIdCache[bookName]
    if (!bookId) {
        const booksResponse = await wikiAxios.get(`${wikiBaseUrl}/books`, { params: { "filter[slug]": bookName } })
        const books = booksResponse.data.data
        const book = books.find((b: any) => b.slug === bookName)
        if (!book) throw "Book not found"
        bookId = bookIdCache[bookName] = book.id
    }
    let pageId = pageIdCache[`${bookId}-${pageName}`]
    if (!pageId) {
        const bookResponse = await wikiAxios.get(`${wikiBaseUrl}/books/${bookId}`)
        const contents = bookResponse.data.contents
        let page = contents.find((c: any) => c.type === "page" && c.slug === pageName)
        if (!page) {
            const chapters = contents.filter((c: any) => c.type === "chapter")
            for (const chapter of chapters) {
                page = chapter.pages.find((p: any) => p.slug === pageName)
                if (page) break
            }
        }
        if (!page) throw "Page not found"
        pageId = pageIdCache[`${bookId}-${pageName}`] = page.id
    }
    const pageResponse = await wikiAxios.get(`${wikiBaseUrl}/pages/${pageId}`)
    return pageResponse.data
}

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
