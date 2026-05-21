import { fetchLatestUsePlanPdf, extractTextFromPdf } from "../fetcher"
import { parseUsePlanText, filterRestrictions } from "../parser"
import { detectStrikethroughAreas } from "../strikethrough"

async function main() {
    const f = await fetchLatestUsePlanPdf()
    const struck = await detectStrikethroughAreas(f.buffer)
    console.log("struck area ids:", [...struck].sort())

    const text = await extractTextFromPdf(f.buffer)
    const { restrictions } = parseUsePlanText(text)
    const { included, excluded } = filterRestrictions(
        restrictions,
        "all",
        new Set(),
        struck,
    )
    console.log("included:", included.length, "excluded strikethrough:", excluded.length)
    for (const e of excluded) console.log(" ", e.name, e.reason)
    const r13 = included.some((r) => r.name.includes("R13"))
    const r22c = included.some((r) => r.name.includes("R22C"))
    console.log("ESR13 in output:", r13, "ESR22C in output:", r22c)
}

main().catch(console.error)
