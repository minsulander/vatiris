<template>
    <div v-if="settings.enablePLS && (!settings.useVatsimConnect || auth.user)">
        <v-row align="center" no-gutters>
            <v-col cols="auto" class="mr-2">
                <span v-if="matchedController1" class="text-grey">
                    <v-tooltip location="bottom" :text="getTooltipText(matchedController1)">
                        <template v-slot:activator="{ props }">
                            <span
                                v-bind="props"
                                @click="openBreakModal(1)"
                                :class="sessionTimeClass1"
                            >
                                {{ formattedSessionTime1 }}
                            </span>
                        </template>
                    </v-tooltip>
                    <v-tooltip :text="getTooltipText(matchedController1)">
                        <template v-slot:activator="{ props }">
                            <span v-bind="props">
                                {{ controllerStatus1 }}
                            </span>
                        </template>
                    </v-tooltip>
                </span>
            </v-col>
            <v-col cols="auto" v-if="settings.plsLogic !== 'simple'">
                <v-btn icon class="text-grey" @click="openPositionModal">
                    <v-icon>{{ hasControllerData ? "mdi-account" : "mdi-account-outline" }}</v-icon>
                </v-btn>
            </v-col>
            <v-col cols="auto" class="ml-2">
                <span v-if="matchedController2" class="text-grey">
                    <v-tooltip location="bottom" :text="getTooltipText(matchedController2)">
                        <template v-slot:activator="{ props }">
                            <span
                                v-bind="props"
                                @click="openBreakModal(2)"
                                :class="sessionTimeClass2"
                            >
                                {{ formattedSessionTime2 }}
                            </span>
                        </template>
                    </v-tooltip>
                    <v-tooltip :text="getTooltipText(matchedController2)">
                        <template v-slot:activator="{ props }">
                            <span v-bind="props">
                                {{ controllerStatus2 }}
                            </span>
                        </template>
                    </v-tooltip>
                </span>
            </v-col>
        </v-row>

        <v-dialog v-model="showBreakModal" max-width="400">
            <v-card>
                <v-card-title>
                    {{
                        selectedController
                            ? `${selectedController.position}: ${selectedController.name} (${selectedController.cid})`
                            : "Go on break"
                    }}
                </v-card-title>
                <v-card-text> Are you sure you want to go on break? </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" variant="text" @click="showBreakModal = false"
                        >Cancel</v-btn
                    >
                    <v-btn color="error" variant="text" @click="goOnBreak">Confirm</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Position modal -->
        <v-dialog v-model="showPositionModal" max-width="400">
            <v-card>
                <v-card-title v-if="settings.plsLogic === 'CID'">
                    {{
                        auth.user
                            ? `${auth.user.personal.name_full} (${auth.user.cid})`
                            : "Go on position"
                    }}
                </v-card-title>
                <v-card-title v-else>
                    Go on position:
                    {{
                        availablePositions.length === 1
                            ? availablePositions[0]
                            : `${availablePositions[0]}/${availablePositions[1]}`
                    }}
                </v-card-title>
                <v-card-text>
                    <template v-if="settings.plsLogic === 'CID'">
                        <v-radio-group
                            inline
                            v-model="selectedCIDIndex"
                            v-if="availableCIDs.length > 1"
                        >
                            <v-row no-gutters>
                                <v-col
                                    v-for="(cid, index) in availableCIDs"
                                    :key="index"
                                    cols="6"
                                    class="d-flex justify-center"
                                >
                                    <v-radio :label="cid" :value="index"></v-radio>
                                </v-col>
                            </v-row>
                        </v-radio-group>
                        <v-text-field
                            v-model="selectedCallsign"
                            label="Callsign"
                            required
                        ></v-text-field>
                    </template>
                    <template v-else>
                        <v-text-field
                            v-model="enteredCID"
                            label="Enter CID"
                            required
                            @input="findController"
                        ></v-text-field>
                        <p v-if="foundController">{{ foundController.name }} found</p>
                        <p v-else-if="controllerMessage" class="error--text">
                            {{ controllerMessage }}
                        </p>
                        <v-radio-group
                            inline
                            v-model="selectedPositionIndex"
                            v-if="availablePositions.length > 1"
                        >
                            <v-row no-gutters>
                                <v-col
                                    v-for="(position, index) in availablePositions"
                                    :key="index"
                                    cols="6"
                                    class="d-flex justify-center"
                                >
                                    <v-radio :label="position" :value="index"></v-radio>
                                </v-col>
                            </v-row>
                        </v-radio-group>
                        <v-text-field
                            v-model="selectedCallsign"
                            label="Callsign (if not implied by position)"
                        ></v-text-field>
                    </template>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" variant="text" @click="showPositionModal = false"
                        >Cancel</v-btn
                    >
                    <v-btn
                        color="blue"
                        variant="text"
                        @click="goOnPosition"
                        :disabled="!canGoOnPosition"
                        >Confirm</v-btn
                    >
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
import axios from "axios"
import { ref, onMounted, watch, computed, onUnmounted } from "vue"
import useEventBus from "@/eventbus"
import { useSettingsStore } from "@/stores/settings"
import { useAuthStore } from "@/stores/auth"
import { useVatsimStore } from "@/stores/vatsim"
import type { Controller } from "@/stores/vatsim"
import moment from "moment"

const plsApiBaseUrl = import.meta.env.VITE_PLSAPI_BASE_URL || "http://localhost:3001/api"

const settings = useSettingsStore()
const auth = useAuthStore()
const vatsim = useVatsimStore()
const bus = useEventBus()

const matchedController1 = ref(null as any)
const matchedController2 = ref(null as any)
const sessionStartTime1 = ref(null as Date | null)
const sessionStartTime2 = ref(null as Date | null)
const currentTime = ref(new Date()) // Reactive timestamp for timer updates

const controllerStatus1 = ref("")
const controllerStatus2 = ref("")

const showBreakModal = ref(false)
const selectedControllerIndex = ref(null as number | null)
const breakType = ref("pause")

const activeControllers = ref([])
const availableControllers = ref([])
const awayControllers = ref([])

const fetchControllersTryCount = ref(0)

const fetchControllers = async () => {
    fetchControllersTryCount.value++
    try {
        const response = await axios.get(`${plsApiBaseUrl}/controllers`)
        const controllers = response.data
        activeControllers.value = controllers.activeControllers || []
        availableControllers.value = controllers.availableControllers || []
        awayControllers.value = controllers.awayControllers || []
        matchControllers(controllers)
        fetchControllersTryCount.value = 0
    } catch (error) {
        console.error("Error fetching controllers:", error)
    }
}

const matchControllers = (controllers: any) => {
    const { activeControllers, availableControllers, awayControllers } = controllers
    const allControllers = [...activeControllers, ...availableControllers, ...awayControllers]

    if (settings.plsLogic === "CID") {
        const cid1 = settings.useVatsimConnect ? auth.user?.cid.toString() : settings.cid1
        const cid2 = settings.cid2

        matchedController1.value = cid1
            ? allControllers.find((controller) => controller.cid === cid1)
            : null
        matchedController2.value = cid2
            ? allControllers.find((controller) => controller.cid === cid2)
            : null

        controllerStatus1.value = getControllerStatus(
            matchedController1.value,
            activeControllers,
            availableControllers,
            awayControllers,
        )
        controllerStatus2.value = getControllerStatus(
            matchedController2.value,
            activeControllers,
            availableControllers,
            awayControllers,
        )
    } else if (settings.plsLogic === "simple") {
        const cid1 = settings.useVatsimConnect ? auth.user?.cid.toString() : settings.cid1
        const cid2 = settings.cid2

        // Find controllers in VATSIM data
        const vatsimController1 = cid1 ? vatsim.data.controllers.find((c: Controller) => c.cid.toString() === cid1) : null
        const vatsimController2 = cid2 ? vatsim.data.controllers.find((c: Controller) => c.cid.toString() === cid2) : null

        // Convert VATSIM controller to PLS format
        matchedController1.value = vatsimController1 ? {
            cid: vatsimController1.cid,
            name: vatsimController1.name,
            position: vatsimController1.callsign,
            callsign: vatsimController1.callsign,
            timestamp: vatsimController1.logon_time
        } : null

        matchedController2.value = vatsimController2 ? {
            cid: vatsimController2.cid,
            name: vatsimController2.name,
            position: vatsimController2.callsign,
            callsign: vatsimController2.callsign,
            timestamp: vatsimController2.logon_time
        } : null

        // Set controller status based on callsign in simple mode
        controllerStatus1.value = vatsimController1?.callsign?.includes("_OBS") ? "O" : ""
        controllerStatus2.value = vatsimController2?.callsign?.includes("_OBS") ? "O" : ""
        
        // Update session start times from logon_time (which is a string timestamp)
        if (matchedController1.value && matchedController1.value.timestamp) {
            const logonDate = new Date(matchedController1.value.timestamp)
            if (!isNaN(logonDate.getTime())) {
                sessionStartTime1.value = logonDate
            } else {
                sessionStartTime1.value = null
            }
        } else {
            sessionStartTime1.value = null
        }
        
        if (matchedController2.value && matchedController2.value.timestamp) {
            const logonDate = new Date(matchedController2.value.timestamp)
            if (!isNaN(logonDate.getTime())) {
                sessionStartTime2.value = logonDate
            } else {
                sessionStartTime2.value = null
            }
        } else {
            sessionStartTime2.value = null
        }
        
        return // Early return to avoid setting session times again below
    } else if (settings.plsLogic === "Position") {
        // Only look in activeControllers for position logic
        matchedController1.value = settings.position1
            ? activeControllers.find(
                  (controller: any) => controller.position === settings.position1,
              )
            : null
        matchedController2.value = settings.position2
            ? activeControllers.find(
                  (controller: any) => controller.position === settings.position2,
              )
            : null

        controllerStatus1.value = ""
        controllerStatus2.value = ""
    }

    // Set session start times (only for CID and Position modes, simple mode handles it above)
    if (settings.plsLogic !== "simple") {
        sessionStartTime1.value = matchedController1.value
            ? new Date(matchedController1.value.timestamp)
            : null
        sessionStartTime2.value = matchedController2.value
            ? new Date(matchedController2.value.timestamp)
            : null
    }
}

const getControllerStatus = (
    controller: any,
    activeControllers: any[],
    availableControllers: any[],
    awayControllers: any[],
) => {
    if (!controller) return ""
    if (activeControllers.some((c: any) => c.cid === controller.cid)) return ""
    if (availableControllers.some((c: any) => c.cid === controller.cid)) return "P"
    if (awayControllers.some((c: any) => c.cid === controller.cid)) return "\u00D6"
    return ""
}

const formatSessionTime = (startTime: Date | null) => {
    if (!startTime) return "00:00:00"

    // Use currentTime to ensure reactivity
    const now = currentTime.value
    const diff = now.getTime() - startTime.getTime()
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

const sessionTimeClass1 = computed(() => {
    if (canGoOnBreak(matchedController1.value)) {
        const minutes = moment(currentTime.value).diff(sessionStartTime1.value, "minute")
        if (minutes >= 120) return "text-red-darken-1 cursor-pointer"
        else if (minutes >= 90) return "text-yellow-darken-2 cursor-pointer"
        else return "text-grey cursor-pointer"
    }
    return "text-grey"
})

const sessionTimeClass2 = computed(() => {
    if (canGoOnBreak(matchedController2.value)) {
        const minutes = moment(currentTime.value).diff(sessionStartTime2.value, "minute")
        if (minutes >= 120) return "text-red-darken-1 cursor-pointer"
        else if (minutes >= 90) return "text-yellow-darken-2 cursor-pointer"
        else return "text-grey cursor-pointer"
    }
    return "text-grey"
})

const formattedSessionTime1 = computed(() => formatSessionTime(sessionStartTime1.value))
const formattedSessionTime2 = computed(() => formatSessionTime(sessionStartTime2.value))

const canGoOnBreak = (controller: any) => {
    return controller && activeControllers.value.some((c: any) => c.cid === controller.cid)
}

const openBreakModal = (index: number) => {
    const controller = index === 1 ? matchedController1.value : matchedController2.value
    if (canGoOnBreak(controller)) {
        selectedControllerIndex.value = index
        showBreakModal.value = true
    }
}

const goOnBreak = async () => {
    const controller =
        selectedControllerIndex.value === 1 ? matchedController1.value : matchedController2.value
    if (controller) {
        try {
            const breakData = {
                controller: {
                    cid: controller.cid,
                    position: breakType.value,
                    callsign: breakType.value,
                },
            }

            await axios.post(`${plsApiBaseUrl}/controller`, breakData)
            showBreakModal.value = false
            fetchControllers() // Refresh the controller list
        } catch (error) {
            console.error("Error setting controller on break:", error)
        }
    }
}

const selectedController = computed(() => {
    if (selectedControllerIndex.value === 1) {
        return matchedController1.value
    } else if (selectedControllerIndex.value === 2) {
        return matchedController2.value
    }
    return null
})

const showPositionModal = ref(false)
const selectedCallsign = ref("")
const enteredCID = ref("")
const foundController = ref(null as any)
const selectedPositionIndex = ref(0)
const selectedCIDIndex = ref(0)

const availablePositions = computed(() => {
    const positions = []
    if (settings.position1) positions.push(settings.position1)
    if (settings.position2) positions.push(settings.position2)
    return positions
})

const canGoOnPosition = computed(() => {
    if (settings.plsLogic === "CID") {
        return selectedCallsign.value
    } else {
        return foundController.value
    }
})

const openPositionModal = () => {
    showPositionModal.value = true
    selectedCallsign.value = ""
    enteredCID.value = ""
    foundController.value = null
    selectedPositionIndex.value = 0
    selectedCIDIndex.value = 0
}

const findController = () => {
    const allControllers = [
        ...activeControllers.value,
        ...availableControllers.value,
        ...awayControllers.value,
    ]
    foundController.value = allControllers.find((c: any) => c.cid === enteredCID.value)

    if (enteredCID.value && !foundController.value) {
        controllerMessage.value = "Controller not found, sign in to PLS first."
    } else {
        controllerMessage.value = ""
    }
}

const goOnPosition = async () => {
    try {
        let positionData
        if (settings.plsLogic === "CID") {
            const selectedCID = availableCIDs.value[selectedCIDIndex.value]
            positionData = {
                controller: {
                    cid: selectedCID,
                    position: "Online",
                    callsign: selectedCallsign.value,
                },
            }
        } else {
            const selectedPosition = availablePositions.value[selectedPositionIndex.value]
            positionData = {
                controller: {
                    cid: foundController.value.cid,
                    position: selectedPosition,
                    callsign: selectedCallsign.value,
                },
            }
        }

        await axios.post(`${plsApiBaseUrl}/controller`, positionData)
        showPositionModal.value = false
        fetchControllers() // Refresh the controller list
    } catch (error) {
        console.error("Error going on position:", error)
        // You might want to show an error message to the user here
    }
}

const controllerMessage = ref("")

const availableCIDs = computed(() => {
    const cids = []
    if (settings.useVatsimConnect && auth.user?.cid) cids.push(auth.user.cid.toString())
    if (settings.cid1) cids.push(settings.cid1)
    if (settings.cid2) cids.push(settings.cid2)
    return cids.filter((cid, index, self) => self.indexOf(cid) === index) // Remove duplicates
})

const getTooltipText = (controller: any) => {
    if (!controller) return ""
    return `${controller.position}: ${controller.callsign} ${controller.name} (${controller.cid})`
}

const hasControllerData = computed(() => {
    if (settings.plsLogic === "CID") {
        return !!(settings.useVatsimConnect && auth.user?.cid) || !!settings.cid1 || !!settings.cid2
    } else {
        return !!settings.position1 || !!settings.position2
    }
})

onMounted(() => {
    if (auth.user) fetchControllers()

    // Set up interval for fetching controllers every 10 seconds
    const fetchInterval = setInterval(() => {
        if (auth.user && fetchControllersTryCount.value < 3) fetchControllers()
    }, 10000)

    // Set up interval for updating the current time every second to trigger reactivity
    const updateInterval = setInterval(() => {
        currentTime.value = new Date()
    }, 1000)

    // Clean up intervals on component unmount
    onUnmounted(() => {
        clearInterval(fetchInterval)
        clearInterval(updateInterval)
    })
})

// Listen for refresh event from EventBus
bus.on("refresh", () => {
    fetchControllers()
})

watch(
    () => auth.user,
    () => {
        if (auth.user) fetchControllers()
    },
)

watch(
    () => settings.enablePLS,
    (newValue) => {
        if (newValue) {
            fetchControllers()
        } else {
            matchedController1.value = null
            matchedController2.value = null
            sessionStartTime1.value = null
            sessionStartTime2.value = null
        }
    },
)

// Listen for settings changes from EventBus
bus.on("settingsChanged", (updatedSettings) => {
    // Update local settings
    Object.assign(settings, updatedSettings)

    // Re-fetch controllers and match based on new settings
    fetchControllers()
})

// Update the watch for VATSIM data changes
watch(
    () => vatsim.data.controllers,
    () => {
        if (settings.plsLogic === "simple") {
            matchControllers({ activeControllers: [], availableControllers: [], awayControllers: [] })
        }
    },
    { deep: true }
)
</script>

<style scoped>
.cursor-pointer {
    cursor: pointer;
}
</style>
