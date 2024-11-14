<template>
    <div>
        <div style="position: relative">
            <div
                style="
                    position: absolute;
                    right: 0;
                    top: 0;
                    z-index: 101;
                    color: rgba(255, 100, 255, 0.6);
                    background: rgba(0, 0, 0, 0.4);
                    font-family: monospace;
                    font-size: 10px;
                    line-height: 12px;
                    padding: 5px;
                    white-space: pre-wrap;
                    overflow: auto;
                    max-height: calc(100vh - 15px);
                "
            >
                <input
                    type="text"
                    v-model="filterText"
                    placeholder="Filter"
                    style="width: 100%"
                    @keyup.esc="filterText = ''"
                />
                {{ selectionProps }}
            </div>
        </div>
        <div id="map" style="width: 100%; height: 100%"></div>
    </div>
</template>

<style scoped>
input {
    background: transparent;
    color: white;
    box-sizing: border-box;
    outline: none;
    border: 1px solid transparent;
    border-bottom: 1px solid #555;
    margin-bottom: 5px;
}
input:focus {
    border: 1px solid #555;
    border-bottom: 1px solid #888;
}
</style>

<script setup lang="ts">
import { Feature, Map, View } from "ol"
import TileLayer from "ol/layer/Tile"
import { OSM, XYZ } from "ol/source"
import VectorSource from "ol/source/Vector"
import GeoJSON from "ol/format/GeoJSON"
import { useGeographic } from "ol/proj"
import { computed, onMounted, reactive, ref, watch } from "vue"
import VectorLayer from "ol/layer/Vector"
import Style, { type StyleFunction } from "ol/style/Style"
import Fill from "ol/style/Fill"
import Stroke from "ol/style/Stroke"
import RegularShape from "ol/style/RegularShape"
import Text from "ol/style/Text"
import Select, { SelectEvent } from "ol/interaction/Select"
import { useFdpStore } from "@/stores/fdp"
import type { Geometry } from "ol/geom"
import type { FeatureLike } from "ol/Feature"

const fdpStore = useFdpStore()

const fdp = computed(() => fdpStore.fdp)
const geo = computed(() => fdpStore.geo)

const filterText = ref("")

const selection = reactive([] as Feature[])
const selectionProps = reactive([] as any[])

let map: Map | undefined = undefined
let filterFlightIds: string[] = []
let filterSectorIds: string[] = []

const style = (feature: Feature) => {
    const prop = feature.getProperties()
    if (
        filterFlightIds.length &&
        ["entry", "flight", "prediction", "waypoint", "TOC", "TOD"].includes(prop.type) &&
        !filterFlightIds.includes(prop.callsign)
    )
        return new Style()
    if (filterSectorIds.length && prop.type == "sector" && !filterSectorIds.includes(prop.id))
        return new Style()
    return new Style({
        fill: new Fill({
            color: prop.type == "sector" ? "rgba(100, 200, 200, 0.02)" : "rgba(255, 255, 255, 0.1)",
        }),
        stroke: new Stroke({
            color: prop.type == "sector" ? "rgba(100, 200, 200, 0.2)" : "rgba(255, 255, 255, 0.3)",
            width: 1,
        }),
        image: ["entry", "flight", "TOC", "TOD"].includes(prop.type)
            ? new RegularShape({
                  points: prop.type == "entry" ? 6 : prop.type == "flight" ? 4 : 3,
                  rotation: prop.type == "TOD" ? Math.PI : prop.type == "TOC" ? 0 : Math.PI / 4,
                  rotateWithView: true,
                  radius: 5,
                  fill: new Fill({
                      color:
                          prop.type == "entry"
                              ? "rgba(100, 100, 200, 0.3)"
                              : "rgba(255, 255, 255, 0.5)",
                  }),
              })
            : prop.type == "waypoint"
              ? new RegularShape({
                    points: 3,
                    radius: 3,
                    stroke: new Stroke({
                        color: "rgba(255, 255, 255, 0.3)",
                        width: 1,
                    }),
                })
              : undefined,
        text:
            prop.type == "flight"
                ? new Text({
                      text: prop.callsign,
                      offsetX: 5,
                      offsetY: 10,
                      textAlign: "left",
                      fill: new Fill({
                          color: "rgba(200, 200, 200, 0.5)",
                      }),
                  })
                : undefined,
    })
}

let source: VectorSource | undefined = undefined
let layer: VectorLayer<Feature<Geometry>> | undefined = undefined

onMounted(() => {
    useGeographic()

    source = new VectorSource()
    layer = new VectorLayer({
        source,
        style: style as StyleFunction
    })

    const center = [20, 58]
    const zoom = 6
    map = new Map({
        target: "map",
        layers: [
            new TileLayer({
                source: new XYZ({
                    //url: "//tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png"
                    url: "https://basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}.png",
                }),
                visible: true,
                opacity: 1,
                preload: 8,
            }),
            layer,
        ],
        view: new View({
            center,
            zoom,
        }),
    })

    const select = new Select({
        multi: true,
        style: (feature: FeatureLike) => {
            const s = style(feature as Feature<Geometry>)
            s.getFill()?.setColor("rgba(200, 100, 200, 0.2)")
            s.getStroke()?.setColor("rgba(250, 200, 250, 0.5)")
            s.getStroke()?.setWidth(2)
            ;(s.getImage() as RegularShape)?.getFill()?.setColor("rgba(200, 100, 200, 0.8)")
            s.getText()?.getFill()?.setColor("rgba(200, 100, 200, 0.8)")
            return s
        },
    })
    select.on("select", (e: SelectEvent) => {
        for (const f of e.selected) {
            selection.push(f)
        }
        for (const f of e.deselected) {
            const i = selection.indexOf(f)
            if (i >= 0) selection.splice(i, 1)
        }
        selectionProps.splice(0)
        for (const f of selection) {
            const props = f.getProperties()
            delete props.geometry
            selectionProps.push(props)
        }
    })
    map.addInteraction(select)
    ;(window as any).map = map
})

let changeTimeout: any = undefined
watch(filterText, () => {
    filterFlightIds = []
    filterSectorIds = []
    if (filterText.value) {
        filterText.value = filterText.value.toUpperCase()
        if (filterText.value in fdp.value.sectors) filterSectorIds = [filterText.value]
        else if (filterText.value in fdp.value.flights) filterFlightIds = [filterText.value]
        else {
            filterFlightIds = Object.keys(fdp.value.flights).filter((id) =>
                id.toUpperCase().includes(filterText.value.toUpperCase()),
            )
            filterSectorIds = Object.keys(fdp.value.sectors).filter((id) =>
                id.toUpperCase().includes(filterText.value.toUpperCase()),
            )
        }
        if (filterFlightIds.length && !filterSectorIds.length) {
            for (const id of filterFlightIds) {
                for (const seq of fdp.value.flights[id].sequence) {
                    if (!filterSectorIds.includes(seq.sector.id))
                        filterSectorIds.push(seq.sector.id)
                }
            }
        } else if (filterSectorIds.length && !filterFlightIds.length) {
            for (const id of filterSectorIds) {
                for (const seq of fdp.value.sectors[id].sequence) {
                    if (!filterFlightIds.includes(seq.callsign)) filterFlightIds.push(seq.callsign)
                }
            }
        }
    }

    if (changeTimeout) clearTimeout(changeTimeout)
    changeTimeout = setTimeout(() => {
        changeTimeout = undefined
        if (!source) return
        // source.clear()
        // source.addFeatures(new GeoJSON().readFeatures(...))
        for (const f of source.getFeatures()) {
            f.changed()
        }
    }, 300)
})

watch(
    geo,
    () => {
        if (!source) return
        source.clear()
        source.addFeatures(new GeoJSON().readFeatures(geo.value))
        selection.splice(0)
        selectionProps.splice(0)
        // TODO how to update selection?
    },
    { deep: true },
)
</script>
