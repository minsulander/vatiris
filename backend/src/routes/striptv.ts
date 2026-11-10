import { Router, Request, Response } from "express"

const striptv = Router()

/** Query params always applied to YouTube embeds when missing. */
export const ESGG_EMBED_DEFAULTS: Record<string, string> = {
    autoplay: "1",
    mute: "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
}

/**
 * Turn a pasted YouTube watch/studio/share/embed URL into an embed URL
 * with the standard stripview query params filled in when absent.
 * Non-YouTube URLs are returned trimmed unchanged (params not forced).
 */
export function normalizeEsggStreamSrc(raw: string): string {
    const input = (raw || "").trim()
    if (!input) return ""

    let url: URL
    try {
        url = new URL(input)
    } catch {
        return input
    }

    const host = url.hostname.replace(/^www\./, "").toLowerCase()
    const isYoutube =
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtube-nocookie.com" ||
        host === "youtu.be" ||
        host === "studio.youtube.com"

    if (!isYoutube) return input

    let videoId = ""
    if (host === "youtu.be") {
        videoId = url.pathname.split("/").filter(Boolean)[0] || ""
    } else if (url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.slice("/embed/".length).split("/")[0] || ""
    } else if (url.pathname.startsWith("/live/")) {
        videoId = url.pathname.slice("/live/".length).split("/")[0] || ""
    } else if (url.pathname.startsWith("/shorts/")) {
        videoId = url.pathname.slice("/shorts/".length).split("/")[0] || ""
    } else if (url.pathname.startsWith("/video/")) {
        // studio.youtube.com/video/VIDEO_ID/
        videoId = url.pathname.slice("/video/".length).split("/")[0] || ""
    } else if (url.searchParams.get("v")) {
        videoId = url.searchParams.get("v") || ""
    }

    videoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "")
    if (!videoId) return input

    const embed = new URL(`https://www.youtube.com/embed/${videoId}`)
    // Preserve any existing query params from an embed paste, then fill defaults.
    if (url.pathname.startsWith("/embed/")) {
        url.searchParams.forEach((value, key) => {
            embed.searchParams.set(key, value)
        })
    }
    for (const [key, value] of Object.entries(ESGG_EMBED_DEFAULTS)) {
        if (!embed.searchParams.has(key)) embed.searchParams.set(key, value)
    }
    return embed.toString()
}

/** Shared stream URL for STRIPVIEW ESGG. Set STRIPVIEW_ESGG_SRC in backend.env; restart backend. */
striptv.get("/esgg", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store")
    res.json({ src: normalizeEsggStreamSrc(process.env.STRIPVIEW_ESGG_SRC || "") })
})

export default striptv
