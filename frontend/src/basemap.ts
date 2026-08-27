// CARTO basemap tile URLs. The key lives in .env.local (gitignored) and must be
// set in the environment when building for production, see deploy-frontend.sh.
const cartoKey = import.meta.env.VITE_CARTO_KEY

if (!cartoKey) console.warn("VITE_CARTO_KEY is not set, CARTO basemap tiles may fail to load")

function carto(url: string) {
    return cartoKey ? `${url}?key=${cartoKey}` : url
}

export const CARTO_LIGHT_NOLABELS_URL = carto(
    "https://s.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
)

export const CARTO_DARK_NOLABELS_URL = carto(
    "https://basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}.png",
)
