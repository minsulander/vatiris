/**
 * Detect area rows cancelled by horizontal strikethrough lines in LFV AUP PDFs.
 * Plain text extraction (pdf-parse) does not include line graphics.
 */

const STROKE_MIN_WIDTH = 100
const STROKE_MAX_HEIGHT = 5
const STROKE_Y_TOLERANCE = 8
const AREA_LABEL_RE = /^ES\s*SUP|^ES\s*R/i

export interface StrikethroughStroke {
    y: number
    x1: number
    x2: number
}

export interface AreaTextMark {
    name: string
    y: number
    page: number
}

function normalizeAreaLabel(str: string): string {
    return str.trim().replace(/\s+/g, "")
}

/** Horizontal stroke paths from constructPath bounding boxes (LFV draws strikethrough as thin wide paths). */
export function extractHorizontalStrokes(
    fnArray: number[],
    argsArray: unknown[],
    OPS: Record<string, number>,
): StrikethroughStroke[] {
    const strokes: StrikethroughStroke[] = []
    const constructPathOp = OPS.constructPath

    for (let i = 0; i < fnArray.length; i++) {
        if (fnArray[i] !== constructPathOp) continue
        const arg = argsArray[i]
        if (!Array.isArray(arg) || arg.length < 3) continue
        const minMax = arg[2] as number[] | null
        if (!minMax || minMax.length < 4) continue
        const [x1, y1, x2, y2] = minMax
        const w = x2 - x1
        const h = y2 - y1
        if (w >= STROKE_MIN_WIDTH && h <= STROKE_MAX_HEIGHT) {
            strokes.push({ y: (y1 + y2) / 2, x1, x2 })
        }
    }
    return strokes
}

export function extractAreaLabels(
    items: Array<{ str: string; transform: number[] }>,
    page: number,
): AreaTextMark[] {
    const marks: AreaTextMark[] = []
    for (const it of items) {
        const str = it.str.trim()
        if (!AREA_LABEL_RE.test(str)) continue
        marks.push({
            name: normalizeAreaLabel(str),
            y: it.transform[5],
            page,
        })
    }
    return marks
}

export function isRowStruck(labelY: number, strokes: StrikethroughStroke[]): boolean {
    return strokes.some(
        (s) =>
            Math.abs(s.y - labelY) <= STROKE_Y_TOLERANCE &&
            s.x1 <= 200 &&
            s.x2 >= 50,
    )
}

export function findStruckAreaIds(
    labels: AreaTextMark[],
    strokesByPage: Map<number, StrikethroughStroke[]>,
): Set<string> {
    const struck = new Set<string>()
    for (const label of labels) {
        const strokes = strokesByPage.get(label.page) || []
        if (isRowStruck(label.y, strokes)) {
            struck.add(label.name)
        }
    }
    return struck
}

export async function detectStrikethroughAreas(pdfBuffer: Buffer): Promise<Set<string>> {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise

    const allLabels: AreaTextMark[] = []
    const strokesByPage = new Map<number, StrikethroughStroke[]>()

    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p)
        const ops = await page.getOperatorList()
        strokesByPage.set(
            p,
            extractHorizontalStrokes(ops.fnArray, ops.argsArray, pdfjs.OPS as Record<string, number>),
        )

        const content = await page.getTextContent()
        allLabels.push(
            ...extractAreaLabels(
                content.items as Array<{ str: string; transform: number[] }>,
                p,
            ),
        )
    }

    return findStruckAreaIds(allLabels, strokesByPage)
}
