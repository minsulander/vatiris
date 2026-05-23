import { fetchLatestUsePlanPdf, extractTextFromPdf } from "../fetcher"
import { extractPlanDateUtc } from "../parser-modern"
import { parseUsePlanFromPdfLayout } from "../parser-layout"
import { serializeTopSky } from "../parser"

async function main() {
    const f = await fetchLatestUsePlanPdf()
    const t = await extractTextFromPdf(f.buffer)
    const plan = extractPlanDateUtc(t)!
    const r = await parseUsePlanFromPdfLayout(f.buffer, plan)
    for (const name of ["ESR18A", "ESD155", "ESR22A", "ESR13"]) {
        for (const h of r.restrictions.filter((x) => x.name.includes(name.replace("ES", "")))) {
            console.log(
                h.name,
                h.from.toISOString(),
                "->",
                h.to.toISOString(),
                serializeTopSky([h]).split("\n")[1],
            )
        }
    }
    console.log("total", r.restrictions.length, "warnings", r.parseWarnings.length)
}

main().catch(console.error)
