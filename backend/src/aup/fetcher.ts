import axios from "axios"
import * as cheerio from "cheerio"

export const LFV_BASE_URL = "https://aro.lfv.se"
export const LFV_DAILY_USE_PATH =
    "/Editorial/View/GeneralDocument?torLinkId=337&type=AIS&folderId=77"

const HTTP_OPTS = {
    timeout: 30_000,
    headers: { "User-Agent": "VatIRIS-AUP/1.0" },
}

export interface FetchedUsePlanPdf {
    sourcePageUrl: string
    pdfUrl: string
    buffer: Buffer
}

export async function fetchLatestUsePlanPdf(): Promise<FetchedUsePlanPdf> {
    const sourcePageUrl = `${LFV_BASE_URL}${LFV_DAILY_USE_PATH}`
    const htmlRes = await axios.get<string>(sourcePageUrl, { ...HTTP_OPTS, responseType: "text" })
    const $ = cheerio.load(htmlRes.data)
    const links = $("a.document-link")
        .map((_, el) => $(el).attr("href"))
        .get()
        .filter((href): href is string => !!href)

    if (links.length === 0) {
        throw new Error("No a.document-link found on LFV airspace use plan page")
    }

    const href = links[links.length - 1]
    const pdfUrl = href.startsWith("http") ? href : `${LFV_BASE_URL}${href}`
    const pdfRes = await axios.get<ArrayBuffer>(pdfUrl, {
        ...HTTP_OPTS,
        responseType: "arraybuffer",
    })

    return {
        sourcePageUrl,
        pdfUrl,
        buffer: Buffer.from(pdfRes.data),
    }
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    const pdfParse = (await import("pdf-parse")).default
    const result = await pdfParse(buffer)
    return result.text
}
