import { fetchLatestUsePlanPdf } from "../fetcher"
import { parseUsePlanText, serializeTopSky } from "../parser"
import { extractPlanDateUtc } from "../parser-modern"

async function main() {
    const f = await fetchLatestUsePlanPdf()
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const doc = await pdfjs.getDocument({ data: new Uint8Array(f.buffer) }).promise
    const page = await doc.getPage(1)
    const content = await page.getTextContent()
    const items = (content.items as Array<{ str: string; transform: number[] }>)
        .map((it) => ({ str: it.str.trim(), x: it.transform[4], y: it.transform[5] }))
        .filter((it) => it.str)

    const r18 = items.filter((it) => /R18A|05:00|22:00|0005|22:00/i.test(it.str) || (it.y > 200 && it.y < 212))
    const byY = new Map<number, typeof items>()
    for (const it of items) {
        const y = Math.round(it.y)
        if (!byY.has(y)) byY.set(y, [])
        byY.get(y)!.push(it)
    }


    const pdfParse = (await import("pdf-parse")).default
    const text = (await pdfParse(f.buffer)).text
    const plan = extractPlanDateUtc(text)
    console.log("plan", plan)

    for (const y of [241, 206, 171, 153].sort((a, b) => b - a)) {
        const row = (byY.get(y) || []).sort((a, b) => a.x - b.x)
        if (row.length) console.log(`y=${y}:`, row.map((r) => `${r.x.toFixed(0)}:${r.str}`).join(" | "))
    }

    for (const y of [...byY.keys()].filter((y) => y >= 200 && y <= 212).sort((a, b) => b - a)) {
        const row = byY.get(y)!.sort((a, b) => a.x - b.x)
        console.log(
            `\ny=${y}:`,
            row.map((r) => `${r.x.toFixed(0)}:${r.str}`).join(" | "),
        )
    }

    const parsed = parseUsePlanText(text)
    const r18a = parsed.restrictions.filter((r) => r.name.includes("R18A"))
    for (const r of r18a) {
        console.log("\nparsed R18A:", r.name, "from", r.from.toISOString(), "to", r.to.toISOString())
        console.log(" topsky line:", serializeTopSky([r]).split("\n").pop())
    }
}

main().catch(console.error)
