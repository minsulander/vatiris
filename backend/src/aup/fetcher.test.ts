import assert from "assert"
import {
    addUtcDays,
    collectUsePlanDocumentLinks,
    planDateUtcFrom,
    selectUsePlanPdfLink,
    selectUsePlanPdfLinksForDates,
    targetPlanDatesUtc,
    usePlanSelectionKey,
} from "./fetcher"

const sample = [
    {
        href: "/Editorial/View/General/15999/Daily%20use%20plan%202026-05-23%20version%204",
        label: "Daily use plan 2026-05-23 version 4",
    },
    {
        href: "/Editorial/View/General/16000/Daily%20use%20plan%202026-05-24%20version%201",
        label: "Daily Use Plan 2026-05-24 version 1",
    },
    {
        href: "/Editorial/View/General/16001/Daily%20use%20plan%202026-05-24%20version%203",
        label: "Daily use plan 2026-05-24 version 3",
    },
]

const parsed = collectUsePlanDocumentLinks(
    sample.map((s) => s.href),
    sample.map((s) => s.label),
)
assert.strictEqual(parsed.length, 3)

const pick = selectUsePlanPdfLink(parsed, "2026-05-24")
assert.strictEqual(pick.version, 3)

const both = selectUsePlanPdfLinksForDates(parsed, ["2026-05-23", "2026-05-24"])
assert.strictEqual(both.length, 2)
assert.strictEqual(both[0].planDate, "2026-05-23")
assert.strictEqual(both[1].version, 3)

const morning = new Date(Date.UTC(2026, 4, 23, 11, 30))
assert.deepStrictEqual(targetPlanDatesUtc(morning), ["2026-05-23"])
assert.strictEqual(usePlanSelectionKey(morning), "2026-05-23")

const lunch = new Date(Date.UTC(2026, 4, 23, 12, 0))
assert.deepStrictEqual(targetPlanDatesUtc(lunch), ["2026-05-23", "2026-05-24"])
assert.strictEqual(usePlanSelectionKey(lunch), "2026-05-23+2026-05-24")

assert.strictEqual(addUtcDays("2026-05-23", 1), "2026-05-24")
assert.strictEqual(planDateUtcFrom(new Date(Date.UTC(2026, 4, 23, 23, 59))), "2026-05-23")

const onlyToday = selectUsePlanPdfLinksForDates(parsed, ["2026-05-23"])
assert.strictEqual(onlyToday.length, 1)

const todayOnlyOnPage = collectUsePlanDocumentLinks(
    [sample[0].href],
    [sample[0].label],
)
const mergeWithoutTomorrow = selectUsePlanPdfLinksForDates(todayOnlyOnPage, [
    "2026-05-23",
    "2026-05-24",
])
assert.strictEqual(mergeWithoutTomorrow.length, 1)
assert.strictEqual(mergeWithoutTomorrow[0].planDate, "2026-05-23")

assert.throws(
    () => selectUsePlanPdfLinksForDates(todayOnlyOnPage, ["2026-05-24"]),
    /No daily use plan PDF for 2026-05-24/,
)

console.log("aup/fetcher.test.ts: all assertions passed")
