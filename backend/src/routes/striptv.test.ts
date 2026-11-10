/**
 * Run with: npx tsx src/routes/striptv.test.ts  (from backend/)
 */
import { ESGG_EMBED_DEFAULTS, normalizeEsggStreamSrc } from "./striptv"

function assert(cond: unknown, msg: string) {
    if (!cond) throw new Error(msg)
}

function expectParams(src: string) {
    const u = new URL(src)
    for (const [k, v] of Object.entries(ESGG_EMBED_DEFAULTS)) {
        assert(u.searchParams.get(k) === v, `${src} missing/wrong ${k}`)
    }
}

assert(normalizeEsggStreamSrc("") === "", "empty")
assert(normalizeEsggStreamSrc("  ") === "", "blank")

const fromWatch = normalizeEsggStreamSrc("https://www.youtube.com/watch?v=Bl-sdU2i5ms")
assert(fromWatch.startsWith("https://www.youtube.com/embed/Bl-sdU2i5ms?"), `watch→embed: ${fromWatch}`)
expectParams(fromWatch)

const fromStudio = normalizeEsggStreamSrc("https://studio.youtube.com/video/Bl-sdU2i5ms/")
assert(fromStudio.includes("/embed/Bl-sdU2i5ms"), `studio→embed: ${fromStudio}`)
expectParams(fromStudio)

const fromShort = normalizeEsggStreamSrc("https://youtu.be/Bl-sdU2i5ms")
assert(fromShort.includes("/embed/Bl-sdU2i5ms"), `youtu.be→embed: ${fromShort}`)
expectParams(fromShort)

const bareEmbed = normalizeEsggStreamSrc("https://www.youtube.com/embed/Bl-sdU2i5ms")
expectParams(bareEmbed)

const partial = normalizeEsggStreamSrc(
    "https://www.youtube.com/embed/Bl-sdU2i5ms?autoplay=1&controls=1",
)
const p = new URL(partial)
assert(p.searchParams.get("autoplay") === "1", "keep existing autoplay")
assert(p.searchParams.get("controls") === "1", "keep existing controls")
assert(p.searchParams.get("mute") === "1", "fill mute")
assert(p.searchParams.get("modestbranding") === "1", "fill modestbranding")

const other = normalizeEsggStreamSrc("https://example.com/live.m3u8")
assert(other === "https://example.com/live.m3u8", "non-youtube unchanged")

console.log("striptv normalizeEsggStreamSrc tests OK")
