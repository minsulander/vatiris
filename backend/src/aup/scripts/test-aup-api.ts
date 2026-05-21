async function main() {
    const base = process.env.AUP_TEST_URL || "http://localhost:5172"

    const idsRes = await fetch(`${base}/aup/aup-ids`)
    const ids = await idsRes.json()
    console.log("aup-ids", ids.areasCache?.count, "ids", ids.ids?.length)

    const planRes = await fetch(`${base}/aup/useplan?mode=sectorfile`)
    const plan = await planRes.json()
    console.log("useplan", plan.restrictions?.length, "excluded", plan.excluded?.length)
    console.log("topsky lines", plan.topsky?.split("\n").length)
}

main().catch(console.error)
