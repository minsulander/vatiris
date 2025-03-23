<template>
    <div
        style="
            height: 25px;
            margin-top: -5px;
            margin-left: -5px;
            background: #777;
            white-space: nowrap;
        "
    >
        <v-btn variant="text" rounded="0" size="small" color="white"
            >layers
            <v-menu
                activator="parent"
                transition="slide-y-transition"
                :close-on-content-click="false"
            >
                <v-list density="compact">
                    <v-list-item
                        v-for="(name, key) in selectableLayers"
                        :key="key"
                        @click="toggleLayer(key)"
                    >
                        <v-list-item-title
                            :class="selectedLayers.includes(key) ? 'text-white' : 'text-grey'"
                            >{{ name }}</v-list-item-title
                        >
                    </v-list-item>
                </v-list>
            </v-menu>
        </v-btn>
    </div>
    <div ref="mapcontainer" style="width: 100%; height: calc(100% - 20px)">
        <div style="position: relative">
            <div
                style="
                    position: absolute;
                    right: 3px;
                    z-index: 100;
                    background: rgba(255, 255, 255, 0.6);
                "
                class="pa-2 text-caption"
            >
                <div v-for="selection in selectionProps" :key="selection.IDNR">
                    {{ selection.LOCATION }}
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue"
import { Feature, Map, View } from "ol"
import TileLayer from "ol/layer/Tile"
import { useGeographic } from "ol/proj"
import { XYZ } from "ol/source"
import VectorSource from "ol/source/Vector"
import VectorLayer from "ol/layer/Vector"
import GeoJSON from "ol/format/GeoJSON"
import { bbox } from "ol/loadingstrategy"
import { Style, Stroke, Fill, RegularShape, Text, type StyleFunction } from "ol/style"
import Select, { SelectEvent } from "ol/interaction/Select"
import type { FeatureLike } from "ol/Feature"
import type { Geometry } from "ol/geom"
import useEventBus from "@/eventbus"
import Layer from "ol/layer/Layer"

const BASE_URL = "https://s.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"
const ECHARTS_URL =
    "https://daim.lfv.se/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:3857"

useGeographic()

const mapcontainer = ref()

const selectableLayers = reactive({
    arp: "Airport",
    ctr: "Control Zone",
    tma: "Terminal Monitoring Area",
    aor: "Area of Responsibility",
    vfr: "VFR Reporting Points",
})

const selectedLayers = reactive(["tma", "ctr", "arp", "vfr"])

const selection = reactive([] as Feature[])
const selectionProps = reactive([] as any[])

let map: Map | undefined = undefined
let select: Select | undefined = undefined

onMounted(() => {
    let center = [16, 63]
    let zoom = 5

    if ("echartsMapCenter" in localStorage) center = JSON.parse(localStorage["echartsMapCenter"])
    if ("echartsMapZoom" in localStorage) zoom = JSON.parse(localStorage["echartsMapZoom"])

    map = new Map({
        maxTilesLoading: 4,
        pixelRatio: 1,
        target: mapcontainer.value,
        view: new View({
            center,
            zoom,
        }),
    })
    setupLayers()

    map.on("moveend", () => {
        localStorage["echartsMapCenter"] = JSON.stringify(map.getView().getCenter())
        localStorage["echartsMapZoom"] = JSON.stringify(map.getView().getZoom())
    })

    select = new Select({
        multi: true,

        /*style: (feature: FeatureLike) => {
            const s = style(feature as Feature<Geometry>)
            s.getFill()?.setColor("rgba(200, 100, 200, 0.2)")
            s.getStroke()?.setColor("rgba(250, 200, 250, 0.5)")
            s.getStroke()?.setWidth(2)
            ;(s.getImage() as RegularShape)?.getFill()?.setColor("rgba(200, 100, 200, 0.8)")
            s.getText()?.getFill()?.setColor("rgba(200, 100, 200, 0.8)")
            return s
        },*/
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
        console.log("selectionProps", selectionProps)
    })
    map.addInteraction(select)

    const bus = useEventBus()
    bus.on("refresh", () => {
        map.getLayers().forEach((layer) => {
            const source = (layer as any).getSource && (layer as any).getSource()
            if (source) source.refresh()
        })
    })
    ;(window as any).map = map
})

onUnmounted(() => {})

const layers = {} as { [key: string]: Layer }

function setupLayers() {
    if (!map) return
    if (map.getAllLayers().length == 0) {
        map.addLayer(
            new TileLayer({
                source: new XYZ({
                    url: BASE_URL,
                }),
            }),
        )
    }
    if (selectedLayers.includes("arp"))
        addLayer(
            "arp",
            new VectorLayer({
                source: new VectorSource({
                    format: new GeoJSON(),
                    url: `${ECHARTS_URL}&typename=mais:ARP`,
                    strategy: bbox,
                }),
                style: (feature) => {
                    return new Style({
                        image: new RegularShape({
                            fill: new Fill({
                                color: "#666",
                            }),
                            points: 4,
                            radius: 3,
                            angle: Math.PI / 4,
                        }),
                        text: new Text({
                            text: feature.get("POSITIONINDICATOR").replace(/^ES/, ""),
                            font: "10px sans-serif",
                            fill: new Fill({
                                color: "#666",
                            }),
                            offsetY: 8,
                        }),
                    })
                },
            }),
        )
    if (selectedLayers.includes("aor"))
        addLayer(
            "aor",
            new VectorLayer({
                source: new VectorSource({
                    format: new GeoJSON(),
                    url: `${ECHARTS_URL}&typename=mais:AOR`,
                    strategy: bbox,
                }),
                style: new Style({
                    stroke: new Stroke({
                        color: "#aaa",
                        width: 0.5,
                    }),
                }),
            }),
        )
    if (selectedLayers.includes("ctr"))
        addLayer(
            "ctr",
            new VectorLayer({
                source: new VectorSource({
                    format: new GeoJSON(),
                    url: `${ECHARTS_URL}&typename=mais:CTR`,
                    strategy: bbox,
                }),
                style: new Style({
                    stroke: new Stroke({
                        color: "#999",
                        lineDash: [4, 4],
                        width: 1,
                    }),
                    fill: new Fill({
                        color: "#9991",
                    }),
                }),
            }),
        )
    if (selectedLayers.includes("tma"))
        addLayer(
            "tma",
            new VectorLayer({
                source: new VectorSource({
                    format: new GeoJSON(),
                    url: `${ECHARTS_URL}&typename=mais:TMAS,mais:TMAW`,
                    strategy: bbox,
                }),
                style: new Style({
                    stroke: new Stroke({
                        color: "#99c",
                        width: 1,
                    }),
                    fill: new Fill({
                        color: "#99c1",
                    }),
                }),
            }),
        )
    if (selectedLayers.includes("vfr"))
        addLayer(
            "vfr",
            new VectorLayer({
                source: new VectorSource({
                    format: new GeoJSON(),
                    url: `${ECHARTS_URL}&typename=mais:ECTR`,
                    strategy: bbox,
                }),
                style: (feature) => {
                    return new Style({
                        image: new RegularShape({
                            fill: new Fill({
                                color: "#83f",
                            }),
                            points: 3,
                            radius: map?.getView()?.getZoom()! > 8 ? 5 : 3,
                            angle: Math.PI,
                        }),
                        text:
                            map?.getView()?.getZoom()! > 8
                                ? new Text({
                                      text: feature.get("LOCATION"),
                                      font: "10px sans-serif",
                                      fill: new Fill({
                                          color: "#83f",
                                      }),
                                      offsetY: 12,
                                  })
                                : undefined,
                    })
                },
            }),
        )
}

function addLayer(key: string, layer: Layer) {
    if (key in layers) return
    layers[key] = layer
    map?.addLayer(layer)
}

function toggleLayer(key: string) {
    if (selectedLayers.includes(key)) {
        if (key in layers) {
            map?.removeLayer(layers[key])
            delete layers[key]
        }
        selectedLayers.splice(selectedLayers.indexOf(key), 1)
    } else {
        selectedLayers.push(key)
    }
}

watch(selectedLayers, setupLayers)
</script>
