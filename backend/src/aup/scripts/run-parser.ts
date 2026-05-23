import { getUsePlan } from "../service"

async function main() {
    const data = await getUsePlan({ mode: "sectorfile", refreshPdf: true })
    console.log("Plan dates:", data.planDates.join(" + "))
    console.log("PDFs:", data.pdfUrl)
    console.log("Restrictions:", data.restrictions.length)
    console.log("Warnings:", data.parseWarnings.length)
    console.log("Struck:", data.struckAreaIds.join(", ") || "(none)")
    console.log("Excluded:", data.excluded.length)

    console.log("\nFirst 10 restrictions:")
    for (const r of data.restrictions.slice(0, 10)) {
        const alt = r.altitudeUpper
            ? `${r.altitude}-${r.altitudeUpper} ${r.altitudeType}`
            : `${r.altitude} ${r.altitudeType}`
        console.log(
            `  ${r.name.padEnd(8)} ${alt.padEnd(18)} ${r.from.slice(0, 16)} → ${r.to.slice(0, 16)} ${r.comment || ""}`,
        )
    }

    const bands = data.restrictions.filter((r) => r.altitudeUpper)
    console.log(`\nFL bands (${bands.length}):`)
    for (const r of bands.slice(0, 8)) {
        console.log(`  ${r.name} FL${r.altitude}-FL${r.altitudeUpper}`)
    }
    if (bands.length > 8) console.log(`  ... +${bands.length - 8} more`)

    console.log("\nTopSky (first 8 lines):")
    console.log(data.topsky.split("\n").slice(0, 8).join("\n"))
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
