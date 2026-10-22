import test from "node:test"
import assert from "node:assert/strict"
import { resolveDisplayedSep } from "./efsSepDisplay"

test("override wins per field and blank clears", () => {
    const shown = resolveDisplayedSep(
        { sep: "2.5", dlv: "3", depGap: "6" },
        { sep: "3 nm", depGap: "" },
    )
    assert.equal(shown?.sep, "3")
    assert.equal(shown?.dlv, "3")
    assert.equal(shown?.depGap, undefined)
})

test("absent overrides and {} keep bare SEP", () => {
    assert.equal(resolveDisplayedSep({ sep: "2.5 nm", dlv: "3", depGap: "" })?.sep, "2.5")
    const allAuto = resolveDisplayedSep({ sep: "2.5", dlv: "3.5", depGap: "6" }, {})
    assert.equal(allAuto?.sep, "2.5")
    assert.equal(allAuto?.dlv, "3.5")
    assert.equal(allAuto?.depGap, "6")
})
