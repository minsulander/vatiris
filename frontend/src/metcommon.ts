
export const metarAirports = [
    "ESCF",
    "ESCM",
    "ESDF",
    "ESGG",
    "ESGJ",
    "ESGT",
    "ESGP",
    "ESIA",
    "ESIB",
    "ESKM",
    "ESKN",
    "ESKS",
    "ESMK",
    "ESMQ",
    "ESMS",
    "ESMT",
    "ESMX",
    "ESND",
    "ESNG",
    "ESNK",
    "ESNL",
    "ESNN",
    "ESNO",
    "ESNQ",
    "ESNS",
    "ESNU",
    "ESNV",
    "ESNX",
    "ESNZ",
    "ESOE",
    "ESOK",
    "ESOH",
    "ESOW",
    "ESPA",
    "ESPE",
    "ESSA",
    "ESSB",
    "ESSD",
    "ESSL",
    "ESSP",
    "ESST",
    "ESSV",
    "ESTA",
    "ESTL",
    "ESUP",
    "ESUT",
]

export const tafAirports = [
    "ESCF",
    "ESDF",
    "ESGG",
    "ESGJ",
    "ESGT",
    "ESGP",
    "ESKN",
    "ESMK",
    "ESMQ",
    "ESMS",
    "ESMT",
    "ESMX",
    "ESNG",
    "ESNK",
    "ESNN",
    "ESNO",
    "ESNQ",
    "ESNS",
    "ESNU",
    "ESNZ",
    "ESNX",
    "ESOE",
    "ESPA",
    "ESSA",
    "ESSB",
    "ESSL",
    "ESSV",
    "ESTA",
    "ESTL",
]

export const wxAirports = [
    "ESSA",
    "ESSB",
    "ESOW",
    "ESGG",
    "ESGP",
    "ESGT",
    "ESGJ",
    "ESMS",
    "ESMK",
    "ESMQ",
    "ESMX",
    "ESOH",
    "ESOE",
    "ESOK",
    "ESSL",
    "ESKN",
    "ESKM",
    "ESNL",
    "ESND",
    "ESNX",
    "ESNK",
    "ESNV",
    "ESNG",
    "ESUP",
]

export const atisAirports = [
    "ESGG",
    "ESKN",
    "ESMS",
    "ESNN",
    "ESOW",
    "ESSA",
    "ESSB",
    "ESTL"
]

import qnhtrl from "@/data/qnhtrl.json"

export function calculateTrl(airport: string, qnh: number) {
    for (const qt of qnhtrl) {
        if (qt.airports == airport || qt.airports.split(",").includes(airport) || airport.startsWith(qt.airports)) {
            for (let i = 0; i < qt.qnhTrl.length-1; i++) {
                const trl = qt.qnhTrl[i]
                const qnhLimit = qt.qnhTrl[i+1]
                if (qnh < qnhLimit) return trl
            }
            return qt.qnhTrl[qt.qnhTrl.length-1]
        }
    }
    return undefined
}