<template>
    <div ref="mapcontainer" style="width: 100%; height: 100%">
        <div style="position: relative">
            <div style="position: absolute; right: 3px; z-index: 100">
                {{ time.replace("T", " ") }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import { Map, View } from "ol"
import TileLayer from "ol/layer/Tile"
import { useGeographic } from "ol/proj"
import TileWMS from "ol/source/TileWMS"
import { XYZ } from "ol/source"
import VectorSource from "ol/source/Vector"
import VectorLayer from "ol/layer/Vector"
import GeoJSON from "ol/format/GeoJSON"
import { bbox } from "ol/loadingstrategy"
import { Style, Stroke, Fill, RegularShape, Text } from "ol/style"
import moment from "moment"

const BASE_URL = "http://s.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"
const SMHI_URL = "https://wpt-wts.smhi.se/tile/"
const ECHARTS_URL =
    "https://daim.lfv.se/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:3857"

useGeographic()

const mapcontainer = ref()

let refreshInterval: any = undefined

const time = ref("")

const smhiTime = () => {
    const mom = moment()
    mom.set("minute", Math.floor((mom.minute() - 2) / 5) * 5)
    mom.set("second", 0)
    mom.set("millisecond", 0)
    return mom.toISOString().replace(".000Z", "Z")
}

onMounted(() => {
    time.value = smhiTime()
    let center = [16, 63]
    let zoom = 5

    if ("smhi_map_center" in localStorage) center = JSON.parse(localStorage["smhi_map_center"])
    if ("smhi_map_zoom" in localStorage) zoom = JSON.parse(localStorage["smhi_map_zoom"])

    const map = new Map({
        target: mapcontainer.value,
        layers: [
            new TileLayer({
                source: new XYZ({
                    url: BASE_URL,
                }),
            }),
            new TileLayer({
                source: new TileWMS({
                    url: SMHI_URL,
                    params: {
                        VERSION: "1.1.1",
                        layers: "baltrad:radarcomp-lightning_sweden_wpt",
                        time: time.value,
                        dim_reftime: "",
                    },
                    serverType: "geoserver",
                    transition: 0,
                    projection: "EPSG:900913",
                }),
            }),
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
                            radius: 2,
                            angle: Math.PI / 4,
                        }),
                        text: new Text({
                            text: feature.get("POSITIONINDICATOR").replace(/^ES/, ""),
                            font: "9px sans-serif",
                            fill: new Fill({
                                color: "#666",
                            }),
                            offsetY: 8,
                        }),
                    })
                },
            }),
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
                }),
            }),
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
                }),
            }),
        ],
        view: new View({
            center,
            zoom,
        }),
    })

    map.on("moveend", () => {
        localStorage["smhi_map_center"] = JSON.stringify(map.getView().getCenter())
        localStorage["smhi_map_zoom"] = JSON.stringify(map.getView().getZoom())
    })

    refreshInterval = setInterval(() => {
        const newTime = smhiTime()
        if (newTime != time.value) {
            time.value = newTime
            //console.log("new SMHI time", newTime)
            map.getLayers().forEach((layer) => {
                if (layer instanceof TileLayer && layer.getSource().getParams) {
                    layer.getSource().updateParams({ time: newTime })
                }
            })
        }
    }, 2000)
})

onUnmounted(() => {
    clearInterval(refreshInterval)
})
</script>
