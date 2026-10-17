/** ICAO → AWOS overview viewId (mirrors frontend/src/stores/wx.ts) */
export const viewIdByIcao: { [icao: string]: string } = {
    ESSA: "arlanda-overview.html",
    ESSB: "bromma-overview.html",
    ESNL: "lycksele-overview.html",
    ESKM: "mora-overview.html",
    ESUP: "pajala-overview.html",
    ESMX: "vaxjo-overview.html",
    ESND: "sveg-overview.html",
    ESGP: "save-overview.html",
    ESGT: "trollhattan-overview.html",
    ESGG: "landvetter-overview.html",
    ESSL: "saab-overview.html",
    ESMS: "sturup-overview.html",
    ESOW: "vasteras-overview.html",
    ESOH: "hagfors-overview.html",
    ESNX: "arvidsjaur-overview.html",
    ESNK: "kramfors-overview.html",
    ESMQ: "kalmar-overview.html",
    ESNV: "vilhelmina-overview.html",
    ESMK: "kristianstad-overview.html",
    ESOE: "orebro-overview.html",
    ESOK: "karlstad-overview.html",
    ESNG: "gallivare-overview.html",
    ESKN: "skavsta-overview.html",
    ESGJ: "jonkoping-overview.html",
}

export function getViewId(icao: string): string | undefined {
    return viewIdByIcao[icao.toUpperCase()]
}
