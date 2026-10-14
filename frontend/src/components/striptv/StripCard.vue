<template>
    <div class="strip-card" :class="{ paper: paper }">
        <div class="strip-edge-bar" aria-hidden="true" />
        <div class="strip-row">
            <div class="strip-rail" aria-hidden="true" />
            <div class="strip-face">
                <div
                    class="strip-rwy"
                    :title="flight.rwyNonStandard ? 'Departure runway (non-standard)' : 'Departure runway'"
                >
                    <span class="strip-rwy-text" :class="{ 'rwy-nonstandard': flight.rwyNonStandard }">
                        {{ flight.runway || "—" }}
                    </span>
                </div>
                <div class="strip-body">
                    <!-- Row 1: C/S · ATD · CFL (shared baseline). Row 2: ATYP · ▲ · SID -->
                    <div class="cell cell-cs">{{ flight.callsign }}</div>
                    <div class="cell cell-atd">
                        <span class="strip-atd" :class="{ empty: !flight.atd }" title="ATD">
                            {{ flight.atd ? formatAtd(flight.atd) : "00:00" }}
                        </span>
                    </div>
                    <div class="cell cell-cfl">
                        <span class="strip-cfl" :class="{ empty: !cflDisplay }" title="CFL">
                            {{ cflDisplay || "0.0" }}
                        </span>
                    </div>
                    <div class="cell cell-typ">
                        <span class="strip-frul">{{ flightRulesLetter }}</span>
                        <span class="strip-atyp">{{ flight.type || "????" }}</span>
                        <span class="strip-wtc">{{ flight.wtc || "" }}</span>
                    </div>
                    <div class="cell cell-tri">
                        <div class="strip-marker-slot">
                            <svg
                                v-if="showTriangle"
                                viewBox="0 0 24 24"
                                preserveAspectRatio="none"
                                class="strip-marker"
                                title="CFTO"
                                aria-hidden="true"
                            >
                                <path
                                    d="M2.5 23.2 H21.5 Q23.6 23.2 22.2 20.8 L13.2 2.8 Q12 0.6 10.8 2.8 L1.8 20.8 Q0.4 23.2 2.5 23.2 Z"
                                />
                            </svg>
                        </div>
                    </div>
                    <div class="cell cell-sid" :class="{ 'sid-box': flight.sidEastBox }">
                        {{ sidDisplay || "—" }}
                    </div>
                </div>
            </div>
            <div class="strip-rail" aria-hidden="true" />
        </div>
        <div class="strip-edge-bar" aria-hidden="true" />
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { StripFlight } from "@/composables/useStripDepartures"
import { formatSidForDisplay } from "@/striptv/sidFormat"
import { displayCflForStrip } from "@/striptv/cflFormat"

const props = defineProps<{
    flight: StripFlight
    paper?: boolean
}>()

const flightRulesLetter = computed(() => {
    const fr = (props.flight.flightRules || "I").toUpperCase()
    if (fr.startsWith("V")) return "V"
    if (fr.startsWith("Y")) return "Y"
    if (fr.startsWith("Z")) return "Z"
    return "I"
})

/** Green △ when CFTO and/or ATD (vatefs compactShowDepTriangle). */
const showTriangle = computed(() => !!props.flight.cfto || !!props.flight.atd)

/** Same resolver as vatefs `formatSidForDisplay` (paper = compact). */
const sidDisplay = computed(() =>
    formatSidForDisplay(props.flight.sid, props.flight.tmaExit, !!props.paper),
)

/** Same visibility/format as vatefs `displayCflForStrip`. */
const cflDisplay = computed(() =>
    displayCflForStrip({
        cfl: props.flight.cfl,
        rfl: props.flight.rfl,
        xfl: props.flight.xfl,
        cleared: props.flight.cleared,
    }),
)

function formatAtd(atd: string) {
    const t = atd.replace(/\D/g, "")
    if (t.length >= 4) return `${t.slice(0, 2)}:${t.slice(2, 4)}`
    if (t.length === 2) return `:${t}`
    return atd
}
</script>

<style scoped>
/*
 * Stable tracks (same on every strip):
 *   RWY | C/S+ATYP | ATD+▲ | CFL | SID
 * Empty values keep their slot (visibility:hidden placeholders).
 */
.strip-card {
    --strip-blue: #222da0;
    --strip-edge: 8cqh;
    display: flex;
    flex-direction: column;
    width: 100%;
    /* EFS SAAB ratio: design 400×50 body → 8∶1 */
    aspect-ratio: 8 / 1;
    height: auto;
    background: var(--strip-blue);
    color: #111;
    box-sizing: border-box;
    font-family: "Segoe UI", Tahoma, sans-serif;
    user-select: none;
    flex-shrink: 0;
    container-type: size;
    container-name: strip;
    overflow: hidden;
}
.strip-card.paper {
    --strip-blue: #4a3f6b;
}
.strip-edge-bar {
    height: var(--strip-edge);
    flex-shrink: 0;
    background: var(--strip-blue);
}
.strip-row {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: stretch;
    position: relative;
}
.strip-rail {
    width: 4.5%;
    min-width: 10px;
    flex-shrink: 0;
    background: var(--strip-blue);
    margin: calc(-1 * var(--strip-edge)) 0;
    position: relative;
    z-index: 2;
}
.strip-face {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: stretch;
    background: #eceaf0;
    position: relative;
    z-index: 1;
    overflow: visible;
}
.strip-card.paper .strip-face {
    background: #ebe6f0;
}
.strip-rwy {
    flex: 0 0 14.5%;
    width: 14.5%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    /* Slightly more than top edge inset from blue rail */
    padding-left: calc(var(--strip-edge) + 3cqh);
    padding-right: 2px;
    box-sizing: border-box;
    font-size: 52cqh;
    font-weight: 600;
    letter-spacing: 0.02em;
    position: relative;
    z-index: 0;
}
.strip-rwy-text {
    position: relative;
    z-index: 0;
}
.strip-rwy-text.rwy-nonstandard {
    color: #000;
}
.strip-rwy-text.rwy-nonstandard::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1.15em;
    height: 1.15em;
    min-width: 100%;
    padding: 0 0.08em;
    box-sizing: content-box;
    background: #fddf5f;
    border: 1px solid #c9a82a;
    z-index: -1;
}
.strip-body {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns:
        minmax(0, 0.82fr) /* C/S · ATYP */
        13cqw /* ATD · ▲ */
        9cqw /* CFL */
        minmax(0, 1.5fr); /* SID */
    grid-template-rows: 1fr 1fr;
    grid-template-areas:
        "cs  atd cfl ."
        "typ tri .   sid";
    column-gap: 1px;
    padding: 2px 6px 0 2px;
    align-items: stretch;
    position: relative;
    overflow: visible;
}
.cell {
    min-width: 0;
    min-height: 0;
}
/* Top row: C/S, ATD, CFL share one baseline */
.cell-cs,
.cell-atd,
.cell-cfl {
    display: flex;
    align-items: baseline;
    line-height: 1;
}
.cell-cs {
    grid-area: cs;
    align-self: end;
    padding-left: 1px;
    font-size: 36cqh;
    font-weight: 700;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: visible;
    z-index: 2;
}
.cell-atd {
    grid-area: atd;
    align-self: end;
    justify-content: center;
    margin-left: -4cqw;
    z-index: 1;
}
.strip-atd {
    font-size: 28cqh;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    color: #111;
    line-height: 1;
    white-space: nowrap;
    text-align: center;
}
.cell-cfl {
    grid-area: cfl;
    align-self: end;
    justify-content: flex-start;
    margin-left: -2cqw;
    z-index: 1;
}
.strip-cfl {
    font-size: 36cqh;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    color: #111;
    line-height: 1;
    white-space: nowrap;
}
.strip-atd.empty,
.strip-cfl.empty {
    visibility: hidden;
}
.cell-typ {
    grid-area: typ;
    display: flex;
    align-items: baseline;
    align-self: start;
    gap: 0.3em;
    padding-left: 1px;
    padding-top: 1px;
    font-size: 24cqh;
    font-weight: 500;
    line-height: 1.05;
    overflow: visible;
    z-index: 2;
}
.strip-frul,
.strip-atyp,
.strip-wtc {
    white-space: nowrap;
}
.cell-tri {
    grid-area: tri;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    align-self: start;
    margin-left: -4cqw;
    z-index: 1;
}
.strip-marker-slot {
    display: flex;
    justify-content: center;
    flex-shrink: 0;
    line-height: 0;
}
/* 1.8∶1 wider base (EFS CTO) */
.strip-marker {
    display: block;
    width: 62cqh;
    aspect-ratio: 1.8 / 1;
    height: auto;
    max-height: 64cqh;
    fill: #008001;
    stroke: none;
    overflow: visible;
}
/* SID slot always same size; content right-aligned inside */
.cell-sid {
    grid-area: sid;
    align-self: stretch;
    justify-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 0 calc(-1 * var(--strip-edge)) 0;
    padding: 2px 6px;
    /* Transparent border reserves thick-frame geometry on every strip */
    border: var(--strip-edge) solid transparent;
    box-sizing: border-box;
    font-size: 32cqh;
    font-weight: 600;
    text-align: center;
    color: #111;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    position: relative;
    z-index: 3;
    background: transparent;
}
.cell-sid.sid-box {
    border-color: #111;
    background: #eceaf0;
}
.strip-card.paper .cell-sid.sid-box {
    background: #ebe6f0;
}
</style>
