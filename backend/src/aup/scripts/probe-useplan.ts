import { fetchLatestUsePlanPdf, extractTextFromPdf } from "../fetcher"
import { parseUsePlanText } from "../parser"

async function main() {
    const f = await fetchLatestUsePlanPdf()
    console.log("pdfUrl", f.pdfUrl)
    const t = await extractTextFromPdf(f.buffer)
    const lines = t.split(/\r?\n/).filter((l) => /ES|maj|FL|ft/i.test(l))
    console.log("lines with ES:", lines.length)
    console.log("sample:\n", lines.slice(0, 15).join("\n---\n"))
    console.log("\nfull text head:\n", t.slice(0, 2000))
    const p = parseUsePlanText(t)
    console.log("parsed:", p.restrictions.length, "warnings:", p.parseWarnings.length)
    if (p.restrictions[0]) console.log("first:", p.restrictions[0])
    console.log("sample warnings:", p.parseWarnings.slice(0, 3))
    console.log("sample restrictions:", p.restrictions.slice(0, 3))
}

main().catch(console.error)
