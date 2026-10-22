export interface SepFields {
    sep?: string | number
    dlv?: string | number
    depGap?: string | number
}

/** TWR display strings. Absent key = auto. "" blanks that field. */
export interface SepOverrides {
    sep?: string
    dlv?: string
    depGap?: string
}

const SEP_FIELDS = ["sep", "dlv", "depGap"] as const

function stripNm(v: string | number | undefined | null): string | number | undefined {
    if (v === undefined || v === null || v === "") return undefined
    if (typeof v === "number") return v
    const s = String(v).replace(/\s*nm\s*/gi, "").trim()
    return s || undefined
}

function normalizeBare(raw?: SepFields | null): SepFields | undefined {
    if (!raw) return undefined
    const sep: SepFields = {}
    for (const key of SEP_FIELDS) {
        const v = stripNm(raw[key])
        if (v !== undefined) sep[key] = v
    }
    return Object.keys(sep).length ? sep : undefined
}

/**
 * Manual override wins per field. A missing override key keeps the bare value.
 * A blank override clears that field (DEP GAP "").
 */
export function resolveDisplayedSep(
    bare?: SepFields | null,
    overrides?: SepOverrides | null,
): SepFields | undefined {
    const out: SepFields = { ...(normalizeBare(bare) || {}) }
    if (overrides && typeof overrides === "object") {
        for (const key of SEP_FIELDS) {
            if (!Object.prototype.hasOwnProperty.call(overrides, key)) continue
            const shown = stripNm(overrides[key])
            if (shown === undefined) delete out[key]
            else out[key] = shown
        }
    }
    return Object.keys(out).length ? out : undefined
}
