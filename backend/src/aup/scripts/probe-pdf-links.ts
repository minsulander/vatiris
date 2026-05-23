import {
    AUP_MERGE_UTC_HOUR,
    fetchUsePlanPdfs,
    listUsePlanDocumentLinks,
    targetPlanDatesUtc,
    usePlanSelectionKey,
} from "../fetcher"

async function main() {
    const { links } = await listUsePlanDocumentLinks()
    console.log("UTC now:", new Date().toISOString())
    console.log("Merge from:", AUP_MERGE_UTC_HOUR + ":00 UTC")
    console.log("Target dates:", targetPlanDatesUtc().join(" + "))
    console.log("Selection key:", usePlanSelectionKey())
    console.log("document-link count:", links.length)
    for (const l of links) console.log(l)

    const bundle = await fetchUsePlanPdfs()
    console.log("\nfetchUsePlanPdfs:")
    for (const p of bundle.pdfs) console.log(" ", p.planDate, "v" + p.version, p.pdfUrl)
}

main().catch(console.error)
