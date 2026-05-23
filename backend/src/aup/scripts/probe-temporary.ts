import { fetchLatestUsePlanPdf } from "../fetcher"

async function main() {
    const f = await fetchLatestUsePlanPdf()
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const doc = await pdfjs.getDocument({ data: new Uint8Array(f.buffer) }).promise

    for (const p of [3, 4, 5, 6]) {
        const page = await doc.getPage(p)
        const content = await page.getTextContent()
        const items = (content.items as Array<{ str: string; transform: number[] }>)
            .map((it) => ({ str: it.str.trim(), x: it.transform[4], y: it.transform[5] }))
            .filter((it) => it.str)

        const rows = new Map<number, typeof items>()
        for (const it of items) {
            const y = Math.round(it.y)
            let key = y
            for (const k of rows.keys()) {
                if (Math.abs(k - y) <= 2) {
                    key = k
                    break
                }
            }
            if (!rows.has(key)) rows.set(key, [])
            rows.get(key)!.push(it)
        }

        console.log(`\n=== Page ${p} rows (y 100-450) ===`)
        for (const y of [...rows.keys()].filter((y) => y >= 100 && y <= 450).sort((a, b) => b - a)) {
            const row = rows.get(y)!.sort((a, b) => a.x - b.x)
            const line = row.map((r) => `${r.x.toFixed(0)}:${r.str}`).join(" | ")
            if (/D3|Temporary|FL\d|jan|dec|ES SUP|ESD/i.test(line)) console.log(`y=${y}`, line)
        }
    }
}

main().catch(console.error)
