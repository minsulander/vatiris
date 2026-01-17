<template>
    <div
        style="
            height: 25px;
            margin-top: -5px;
            margin-left: -5px;
            background: #777;
            white-space: nowrap;
            overflow: hidden;
        "
    >
        <v-btn variant="text" rounded="0" size="small" color="white"
            >layers
            <v-menu
                activator="parent"
                transition="slide-y-transition"
                :close-on-content-click="false"
                @click:outside="lastFocused = Date.now()"
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
        <span class="float-right mr-1 pt-1 text-caption text-grey-lighten-2">
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="resettable ? 'white' : 'grey'"
                style="margin-top: -3px"
                @click="reset"
                >RES</v-btn
            >
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="resettable ? 'white' : 'grey'"
                style="margin-top: -3px"
                @click="set"
                >SET</v-btn
            >
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="selection.length > 0 ? 'white' : 'grey'"
                style="margin-top: -3px"
                @click="clearSelection"
                >CLEAR</v-btn
            >
        </span>
    </div>
    <div ref="mapcontainer" style="width: 100%; height: calc(100% - 20px); overflow: hidden">
        <div style="position: relative">
            <div
                v-if="selection.length > 0"
                style="
                    position: absolute;
                    right: 0;
                    z-index: 100;
                    background: rgba(221, 221, 221, 0.85);
                    max-width: 300px;
                    overflow: auto;
                "
                class="text-caption"
                @contextmenu.prevent="clearSelection"
            >
                <div
                    v-for="selection in selectionPropsSorted"
                    :key="selection.IDNR"
                    :data-idnr="selection.IDNR || selection.ID"
                    class="selection px-1 pb-1"
                    @mouseenter="mouseEnterSelection"
                    @mouseleave="mouseLeaveSelection"
                    @click="console.log(selection)"
                >
                    <div
                        v-if="selection.LOWER && selection.UPPER"
                        class="ml-3 float-right"
                        style="white-space: nowrap"
                    >
                        {{ selection.LOWER }} - {{ selection.UPPER }}
                    </div>
                    <span v-if="selection.TYPEOFPOINT == 'ARP' || selection.TYPEOFPOINT == 'HKP'">
                        {{ selection.POSITIONINDICATOR }}
                    </span>
                    {{ selection.DESIG }}
                    {{
                        selection.LOCATION ||
                        selection.NAMEOFPOINT ||
                        selection.NAMEOFLINE ||
                        selection.NAME
                    }}
                    <span 
                        v-if="getSectorCoverage(selection)" 
                        style="font-weight: bold;"
                    >
                        ({{ getSectorCoverage(selection)?.replace(/_/g, '') }})
                    </span>
                    <div
                        v-if="selection.SCHEDULE"
                        class="text-grey-darken-3"
                        style="font-size: 10px; line-height: 12px"
                    >
                        {{ selection.SCHEDULE }}
                    </div>
                    <div
                        v-if="selection.COM_EN"
                        class="text-grey-darken-2"
                        style="font-size: 10px; line-height: 12px"
                    >
                        {{ selection.COM_EN }}
                    </div>
                    <div
                        v-if="selection.COMMENT_1 && selection.COMMENT_1.length > 1"
                        class="text-grey-darken-3"
                        style="font-size: 10px; line-height: 12px"
                    >
                        {{ selection.COMMENT_1 }}
                    </div>
                    <div
                        v-if="selection.COMMENT_2 && selection.COMMENT_2.length > 1"
                        class="text-grey-darken-3"
                        style="font-size: 10px; line-height: 12px"
                    >
                        {{ selection.COMMENT_2 }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
div.selection:hover {
    background: #ccc;
}
</style>

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
import { Style, Stroke, Fill, RegularShape, Text } from "ol/style"
import Select, { SelectEvent } from "ol/interaction/Select"
import type { FeatureLike } from "ol/Feature"
import useEventBus from "@/eventbus"
import { useWindowsStore } from "@/stores/windows"
import { usePositionsStore } from "@/stores/positions"
import { useSettingsStore } from "@/stores/settings"
import { useAuthStore } from "@/stores/auth"
import { useVatsimStore } from "@/stores/vatsim"
import Layer from "ol/layer/Layer"

const BASE_URL = "https://s.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"
const ECHARTS_URL =
    "https://daim.lfv.se/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:3857"

useGeographic()
const windows = useWindowsStore()
const positions = usePositionsStore()
const settings = useSettingsStore()
const auth = useAuthStore()
const vatsim = useVatsimStore()

const mapcontainer = ref()

const selectableLayers = reactive({
    arp: "Airports",
    hrp: "Heliports",
    ctr: "CTR",
    tma: "TMA",
    tiatizatz: "TIA/TIZ/ATZ",
    deleg: "Delegated airspace",
    acc: "ACC sectors",
    aor: "AOR",
    rd: "R/D areas",
    sup: "Current SUP",
    cbatra: "CBA/TRA",
    pca: "PCA",
    pcs: "PCA sub-parts",
    vfr: "VFR entry/exit",
    dnpt: "Significant points",
    wpt: "Terminal points",
    navaid: "DME/VOR/NDB",
    route: "ATS routes",
})

const selectedLayers = reactive(["tma", "tiatizatz", "ctr", "vfr", "arp"])

const selection = reactive([] as Feature[])
const selectionProps = reactive([] as any[])

// Mode filter: null = both, "ESMM" = ESMM only, "ESOS" = ESOS only
const modeFilter = ref<"ESMM" | "ESOS" | null>(null)
const modeFilterManuallySet = ref(false) // Track if user manually set the mode

// Auto-detect mode from user's position
function detectUserMode(): "ESMM" | "ESOS" | null {
    // First check user's positions (for sector coverage highlighting)
    const myPositions = positions.getMyPositions()
    if (myPositions.length > 0) {
        // Check sectors for user's positions to determine mode
        for (const si of myPositions) {
            const sectors = positions.getPositionSectors(si)
            for (const sector of sectors) {
                if (sector.includes("ESMM")) return "ESMM"
                if (sector.includes("ESOS")) return "ESOS"
            }
        }
    }
    
    // Also check all active positions (for test mode or when user position not set)
    for (const si of positions.activePositions.keys()) {
        const sectors = positions.getPositionSectors(si)
        for (const sector of sectors) {
            if (sector.includes("ESMM")) return "ESMM"
            if (sector.includes("ESOS")) return "ESOS"
        }
    }
    
    // Also check callsign if available
    let userCallsign = ""
    if (settings.useVatsimConnect && auth.user?.cid) {
        const cid = auth.user.cid.toString()
        const controller = vatsim.data?.controllers?.find((c) => c.cid.toString() === cid)
        userCallsign = controller?.callsign || ""
    } else if (settings.cid1) {
        const controller = vatsim.data?.controllers?.find((c) => c.cid.toString() === settings.cid1)
        userCallsign = controller?.callsign || ""
    } else {
        userCallsign = settings.position1 || ""
    }
    
    if (userCallsign.includes("ESMM")) return "ESMM"
    if (userCallsign.includes("ESOS")) return "ESOS"
    
    return null
}

// Update mode filter when positions change
watch(
    () => positions.activePositions,
    () => {
        // Only auto-set if mode filter was not manually set by user
        if (!modeFilterManuallySet.value) {
            const detectedMode = detectUserMode()
            if (detectedMode) {
                modeFilter.value = detectedMode
            }
        }
    },
    { deep: true, immediate: true }
)


// Filter and sort selection props based on mode filter
const selectionPropsSorted = computed(() => {
    let filtered = Object.values(selectionProps)
    
    // Apply mode filter if set
    if (modeFilter.value) {
        filtered = filtered.filter((item) => {
            const desig = item.DESIG?.trim() || ""
            const location = item.LOCATION?.trim() || ""
            const sectorText = desig || location
            return sectorText.startsWith(modeFilter.value!)
        })
    }
    
    // Sort by altitude
    return filtered.sort((a, b) => {
        function str2altitude(str: string | undefined | null) {
            if (!str) return 0
            if (str.startsWith("GND")) return 0
            if (str.startsWith("UNL")) return 9999999
            if (str.startsWith("FL")) return parseInt(str.substring(2)) * 100
            return parseInt(str)
        }
        if (a.UPPER || b.UPPER) {
            return str2altitude(b.UPPER) - str2altitude(a.UPPER)
        }
        if (a.LOWER || b.LOWER) {
            return str2altitude(b.LOWER) - str2altitude(a.LOWER)
        }
        return 0
    })
})

const resetCenter = ref(undefined as any)
const resetZoom = ref(undefined as number | undefined)
const resettable = ref(false)

let map: Map | undefined = undefined
let select: Select | undefined = undefined
let lastFocused = Date.now()

onMounted(() => {
    let center = [16, 63]
    let zoom = 5

    if ("echartsMapCenter" in localStorage) center = JSON.parse(localStorage["echartsMapCenter"])
    if ("echartsMapZoom" in localStorage) zoom = JSON.parse(localStorage["echartsMapZoom"])
    if ("echartsMapLayers" in localStorage) {
        selectedLayers.splice(0)
        const layers = JSON.parse(localStorage["echartsMapLayers"])
        for (const layer of layers) {
            if (layer in selectableLayers && !selectedLayers.includes(layer))
                selectedLayers.push(layer)
        }
    }

    map = new Map({
        maxTilesLoading: 4,
        pixelRatio: 1,
        target: mapcontainer.value,
        view: new View({
            center,
            zoom,
        }),
        controls: [],
    })
    setupLayers()

    map.on("click", (evt) => {
        if (!map) return
        //console.log(evt.coordinate)
    })
    map.getViewport().addEventListener("contextmenu", function (evt) {
        evt.preventDefault()
        clearSelection()
        if (!map) return
        //console.log(map.getEventCoordinate(evt))
    })

    // delay about to not trigger on first (programmatic) move
    setTimeout(
        () =>
            map?.on("moveend", () => {
                if (!map) return
                localStorage["echartsMapCenter"] = JSON.stringify(map.getView().getCenter())
                localStorage["echartsMapZoom"] = JSON.stringify(map.getView().getZoom())
                resettable.value = true
            }),
        500,
    )

    select = new Select({
        multi: true,

        style: (feature: FeatureLike) => {
            const props = feature.getProperties()
            let text: Text | undefined = undefined
            if (props.TYPEOFPOINT || props.TYPEOFLINE || (props.TYPEOFAREA && props.TYPEOFAREA.startsWith("EXE"))) {
                text = new Text({
                    text:
                        props.TYPEOFPOINT == "ECTR" || props.TYPEOFAREA
                            ? props.LOCATION
                            : props.NAMEOFPOINT || props.NAMEOFLINE || props.POSITIONINDICATOR,
                    font: "bold 10px sans-serif",
                    fill: new Fill({
                        color: props.hover ? "#000" : "#33f",
                    }),
                    offsetY: 10,
                })
            }
            return new Style({
                image: new RegularShape({
                    fill: new Fill({
                        color: props.hover ? "#000" : "#33f",
                    }),
                    points: 10,
                    radius: 5,
                }),
                stroke: new Stroke({
                    color: props.hover ? "#000" : "#33f",
                    width: props.hover ? 3 : 2,
                }),
                fill: new Fill({
                    color: props.hover ? "#0001" : "#33f1",
                }),
                text,
                zIndex: props.hover ? 1000 : undefined,
            })
        },

        condition: (e) => {
            if (selection.length == 0 && lastFocused > 0 && Date.now() - lastFocused < 1000)
                return false
            return e.type == "singleclick"
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
        //console.log("selectionPropsSorted", selectionPropsSorted.value)
    })
    map.addInteraction(select)

    const bus = useEventBus()
    bus.on("refresh", () => {
        if (!map) return
        map.getLayers().forEach((layer) => {
            const source = (layer as any).getSource && (layer as any).getSource()
            if (source) source.refresh()
        })
    })

    set()
    ;(window as any).map = map
    
    // Auto-detect and set mode filter based on user's position (only if not manually set)
    if (!modeFilterManuallySet.value) {
        const detectedMode = detectUserMode()
        if (detectedMode) {
            modeFilter.value = detectedMode
        }
    }
})

onUnmounted(() => {})

watch(
    () => windows.focusId,
    (newValue, oldValue) => {
        if (newValue && newValue.startsWith("echarts")) {
            lastFocused = Date.now()
        } else {
            lastFocused = 0
        }
    },
)

watch(selectedLayers, (newValue) => {
    localStorage["echartsMapLayers"] = JSON.stringify(newValue)
})

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
    addGeoJsonLayer(
        "fir",
        `${ECHARTS_URL}&typename=mais:FIR`,
        new Style({
            stroke: new Stroke({
                color: "#555",
                width: 0.5,
            }),
        }),
    )

    if (selectedLayers.includes("arp"))
        addGeoJsonLayer("arp", `${ECHARTS_URL}&typename=mais:ARP`, (feature: FeatureLike) => {
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
        })
    if (selectedLayers.includes("hrp"))
        addGeoJsonLayer("hrp", `${ECHARTS_URL}&typename=mais:HKP_ARP`, (feature: FeatureLike) => {
            return new Style({
                image: new RegularShape({
                    stroke: new Stroke({
                        color: "#666",
                    }),
                    fill: new Fill({
                        color: "#6662",
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
        })
    if (selectedLayers.includes("ctr"))
        addGeoJsonLayer(
            "ctr",
            `${ECHARTS_URL}&typename=mais:CTR`,
            new Style({
                stroke: new Stroke({
                    color: "#999",
                    lineDash: [4, 4],
                    width: 1,
                }),
                fill: new Fill({
                    color: "#9991",
                }),
            }),
        )

    if (selectedLayers.includes("tiatizatz"))
        addGeoJsonLayer(
            "tiatizatz",
            `${ECHARTS_URL}&typename=mais:TIA,mais:TIZ,mais:ATZ`,
            new Style({
                stroke: new Stroke({
                    color: "#999",
                    lineDash: [4, 4],
                    width: 1,
                }),
                fill: new Fill({
                    color: "#99999905",
                }),
            }),
        )

    if (selectedLayers.includes("tma"))
        addGeoJsonLayer(
            "tma",
            `${ECHARTS_URL}&typename=mais:TMAS,mais:TMAW`,
            new Style({
                stroke: new Stroke({
                    color: "#99c",
                    width: 1,
                }),
                fill: new Fill({
                    color: "#9999cc05",
                }),
            }),
        )
    if (selectedLayers.includes("deleg"))
        addGeoJsonLayer(
            "deleg",
            `${ECHARTS_URL}&typename=mais:DELEG`,
            new Style({
                stroke: new Stroke({
                    color: "#2af",
                    width: 1,
                }),
                fill: new Fill({
                    color: "#2af1",
                }),
            }),
        )
    if (selectedLayers.includes("acc"))
        addGeoJsonLayer(
            "acc",
            `${ECHARTS_URL}&typename=mais:ATCCS_ESMM,mais:ATCCS_ESOS`,
            new Style({
                stroke: new Stroke({
                    color: "#25d5",
                    width: 1,
                }),
                fill: new Fill({
                    color: "#2255dd05",
                }),
            }),
        )
    if (selectedLayers.includes("aor"))
        addGeoJsonLayer(
            "aor",
            `${ECHARTS_URL}&typename=mais:AOR`,
            new Style({
                stroke: new Stroke({
                    color: "#55f",
                    lineDash: [8, 8],
                    width: 1.5,
                }),
                fill: new Fill({
                    color: "#55f1",
                }),
            }),
        )
    if (selectedLayers.includes("cbatra"))
        addGeoJsonLayer(
            "cbatra",
            `${ECHARTS_URL}&typename=mais:CBA,mais:TRA`,
            new Style({
                stroke: new Stroke({
                    color: "#55f",
                    lineDash: [6, 6],
                    width: 1.5,
                }),
                fill: new Fill({
                    color: "#55f1",
                }),
            }),
        )
    if (selectedLayers.includes("rd"))
        addGeoJsonLayer(
            "rd",
            `${ECHARTS_URL}&typename=mais:RSTA,mais:DNGA`,
            new Style({
                stroke: new Stroke({
                    color: "#f55",
                    width: 1,
                }),
                fill: new Fill({
                    color: "#f551",
                }),
            }),
        )
    if (selectedLayers.includes("sup"))
        addGeoJsonLayer(
            "sup",
            `${ECHARTS_URL}&typename=DAIM_TOPO:SUP`,
            new Style({
                stroke: new Stroke({
                    color: "#d83",
                    width: 1,
                }),
                fill: new Fill({
                    color: "#d831",
                }),
            }),
        )
    if (selectedLayers.includes("pca"))
        addGeoJsonLayer(
            "pca",
            `${ECHARTS_URL}&typename=mais:EXEA`,
            (feature: FeatureLike) =>
                new Style({
                    stroke: new Stroke({
                        color: "#f55",
                        width: 1,
                    }),
                    fill: new Fill({
                        color: "#f551",
                    }),
                    text: new Text({
                        text: feature.get("LOCATION"),
                        font: "10px sans-serif",
                        fill: new Fill({
                            color: "#f55",
                        }),
                        offsetY: 12,
                    }),
                }),
        )
    if (selectedLayers.includes("pcs"))
        addGeoJsonLayer(
            "pcs",
            `${ECHARTS_URL}&typename=mais:EXES`,
            (feature: FeatureLike) =>
                new Style({
                    stroke: new Stroke({
                        color: "#f55",
                        width: 1,
                    }),
                    fill: new Fill({
                        color: "#f551",
                    }),
                    text: new Text({
                        text: feature.get("LOCATION"),
                        font: "10px sans-serif",
                        fill: new Fill({
                            color: "#f55",
                        }),
                        offsetY: 12,
                    }),
                }),
        )

    if (selectedLayers.includes("vfr"))
        addGeoJsonLayer("vfr", `${ECHARTS_URL}&typename=mais:ECTR`, (feature: FeatureLike) => {
            return new Style({
                image: new RegularShape({
                    fill: new Fill({
                        color: map?.getView()?.getZoom()! > 7 ? "#333" : "#333a",
                    }),
                    points: 3,
                    radius:
                        map?.getView()?.getZoom()! > 8 ? 5 : map?.getView()?.getZoom()! > 7 ? 3 : 2,
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
        })
    if (selectedLayers.includes("route"))
        addGeoJsonLayer("route", `${ECHARTS_URL}&typename=mais:REG`, (feature: FeatureLike) => {
            return new Style({
                stroke: new Stroke({
                    color: "#37d",
                    width: 1,
                }),
                text:
                    map?.getView()?.getZoom()! > 7
                        ? new Text({
                              text: feature.get("NAMEOFLINE"),
                              font: "10px sans-serif",
                              fill: new Fill({
                                  color: "#333",
                              }),
                          })
                        : undefined,
            })
        })
    if (selectedLayers.includes("dnpt"))
        addGeoJsonLayer("dnpt", `${ECHARTS_URL}&typename=mais:DNPT`, (feature: FeatureLike) => {
            return new Style({
                image: new RegularShape({
                    stroke: new Stroke({
                        color: "#66f",
                    }),
                    points: 3,
                    radius: map?.getView()?.getZoom()! > 8.5 ? 5 : 2,
                }),
                text:
                    map?.getView()?.getZoom()! > 8.5
                        ? new Text({
                              text: feature.get("NAMEOFPOINT"),
                              font: "10px sans-serif",
                              fill: new Fill({
                                  color: "#66f",
                              }),
                              offsetY: 12,
                          })
                        : undefined,
            })
        })
    if (selectedLayers.includes("navaid"))
        addGeoJsonLayer(
            "navaid",
            `${ECHARTS_URL}&typename=mais:DME,mais:DMEV,mais:VOR,mais:NDB`,
            (feature: FeatureLike) => {
                return new Style({
                    image: new RegularShape({
                        stroke: new Stroke({
                            color: "#84f",
                        }),
                        points: feature.get("TYPEOFPOINT") == "NDB" ? 8 : 4,
                        radius:
                            (map?.getView()?.getZoom()! > 8.5 ? 5 : 3) *
                            (feature.get("TYPEOFPOINT") == "NDB" ? 0.5 : 1),
                        rotation: Math.PI / 4,
                    }),
                    text:
                        map?.getView()?.getZoom()! > 8.5
                            ? new Text({
                                  text: feature.get("NAMEOFPOINT"),
                                  font: "10px sans-serif",
                                  fill: new Fill({
                                      color: "#84f",
                                  }),
                                  offsetY: 12,
                              })
                            : undefined,
                })
            },
        )
    if (selectedLayers.includes("wpt"))
        addGeoJsonLayer("wpt", `${ECHARTS_URL}&typename=mais:WPT`, (feature: FeatureLike) => {
            return new Style({
                image: new RegularShape({
                    stroke: new Stroke({
                        color: "#666",
                    }),
                    points: 4,
                    radius: map?.getView()?.getZoom()! > 9.5 ? 4 : 2,
                }),
                text:
                    map?.getView()?.getZoom()! > 9.5
                        ? new Text({
                              text: feature.get("NAMEOFPOINT"),
                              font: "10px sans-serif",
                              fill: new Fill({
                                  color: "#666",
                              }),
                              offsetY: 12,
                          })
                        : undefined,
            })
        })
}

watch(selectedLayers, setupLayers)

function addGeoJsonLayer(name: string, url: string, style: Style | any | undefined = undefined) {
    addLayer(
        name,
        new VectorLayer({
            source: new VectorSource({
                format: new GeoJSON(),
                url,
                strategy: bbox,
            }),
            style,
        }),
    )
}

function addLayer(key: string, layer: Layer) {
    if (key in layers) return
    layers[key] = layer
    map?.addLayer(layer)
}

function mouseEnterSelection(e: MouseEvent) {
    const div = e.currentTarget as HTMLElement
    const idnr = div.getAttribute("data-idnr")
    if (!div || !idnr || !map) return
    const feature = findFeature(idnr)
    if (feature) {
        feature.setProperties({ ...feature.getProperties(), hover: true })
        feature.changed()
    }
}

function mouseLeaveSelection(e: MouseEvent) {
    const div = e.currentTarget as HTMLElement
    const idnr = div.getAttribute("data-idnr")
    if (!div || !idnr || !map) return
    const feature = findFeature(idnr)
    if (feature) {
        feature.setProperties({ ...feature.getProperties(), hover: false })
        feature.changed()
    }
}

function findFeature(idnr: string) {
    if (!map) return
    let feature: FeatureLike | undefined = undefined
    for (const layer of map.getAllLayers()) {
        const source = layer.getSource() as VectorSource
        if (!source || !source.getFeatures) continue
        feature = source
            .getFeatures()
            .find((f) => f.getProperties().IDNR == idnr || f.getProperties().ID == idnr)
        if (feature) break
    }
    return feature
}

function toggleLayer(key: string) {
    if (selectedLayers.includes(key)) {
        if (key in layers) {
            map?.removeLayer(layers[key])
            delete layers[key]
        }
        while (selectedLayers.includes(key)) selectedLayers.splice(selectedLayers.indexOf(key), 1)
    } else {
        selectedLayers.push(key)
    }
}

function clearSelection() {
    if (select) select.getFeatures().clear()
    selection.splice(0)
    selectionProps.splice(0)
}

function set() {
    if (!map) return
    resetCenter.value = map.getView().getCenter()
    resetZoom.value = map.getView().getZoom()
    resettable.value = false
}

function reset() {
    if (!map) return
    if (resetCenter.value) map.getView().setCenter(resetCenter.value)
    if (resetZoom.value) map.getView().setZoom(resetZoom.value)
    setTimeout(() => (resettable.value = false), 500)
}

// Get sector coverage information for ACC sectors
function getSectorCoverage(selection: any): string | null {
    // Only show coverage for ACC sectors - check both DESIG and LOCATION fields
    const desig = selection.DESIG?.trim() || ""
    const location = selection.LOCATION?.trim() || ""
    
    // Use DESIG if available, otherwise try LOCATION
    const sectorText = desig || location
    if (!sectorText) return null
    
    // Check if it's an ACC sector (ESMM or ESOS)
    let mode: string | null = null
    let sectorId: string | null = null
    
    if (sectorText.startsWith("ESMM")) {
        mode = "ESMM"
        // Extract sector ID: "ESMM W:1" -> "W", "ESMM 2" -> "2", "ESMM 4:4" -> "4"
        // Split by colon to get main sector ID
        const parts = sectorText.substring(4).trim().split(":")
        if (parts.length > 0 && parts[0]) {
            sectorId = parts[0].trim()
        }
    } else if (sectorText.startsWith("ESOS")) {
        mode = "ESOS"
        // Extract sector ID: "ESOS 4:4" -> "4", "ESOS 1" -> "1", "ESOS F" -> "F"
        // Split by colon to get main sector ID
        const parts = sectorText.substring(4).trim().split(":")
        if (parts.length > 0 && parts[0]) {
            sectorId = parts[0].trim()
        }
    }
    
    if (!mode || !sectorId) {
        return null
    }
    
    // Convert to sectors.txt format: "ESAA·ESMM W" or "ESAA·ESOS 4"
    const sectorName = `ESAA·${mode} ${sectorId}`
    
    // Get the covering position SI
    const controllerSi = positions.getSectorController(sectorName)
    
    return controllerSi || null
}
</script>
