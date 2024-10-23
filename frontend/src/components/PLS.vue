<template>
  <div v-if="settings.enablePLS">
    <template v-if="loading">
      <span>-</span>
    </template>
    <template v-else>
      <v-tooltip v-if="matchedControllers[0].length > 0" :text="getTooltipText(0)" location="bottom">
        <template v-slot:activator="{ props }">
          <span
            class="text-grey"
            style="cursor: pointer"
            v-bind="props"
            @click="handleSessionTimerClick(0)"
          >
            {{ sessionLengths[0] }} {{ statusSuffixes[0] }}
          </span>
        </template>
      </v-tooltip>
      <v-btn
        icon
        class="text-grey"
        @click="showPositionModal = true"
      >
        <v-icon>{{ searchValues[0].length > 0 || searchValues[1].length > 0 ? 'mdi-account' : 'mdi-account-outline' }}</v-icon>
      </v-btn>
      <v-tooltip v-if="matchedControllers[1].length > 0" :text="getTooltipText(1)" location="bottom">
        <template v-slot:activator="{ props }">
          <span
            class="text-grey"
            style="cursor: pointer"
            v-bind="props"
            @click="handleSessionTimerClick(1)"
          >
            {{ sessionLengths[1] }} {{ statusSuffixes[1] }}
          </span>
        </template>
      </v-tooltip>
    </template>

    <!-- Go on Break Modal for CID logic -->
    <v-dialog v-if="searchType === 'CID'" v-model="showBreakModalComputed" max-width="400px">
      <v-card>
        <v-card-title>{{ breakModalController.name }} ({{ breakModalController.CID }}): {{ breakModalController.callsign }}</v-card-title>
        <v-card-text>
          <p>{{ matchedControllers[0]?.name }}</p>
        </v-card-text>
        <v-card-actions>
          <v-row no-gutters>
            <v-col cols="9">
              <v-btn 
                color="error" 
                @click="confirmBreak"
                block
              >
                Go on Break
              </v-btn>
            </v-col>
            <v-col cols="3">
              <v-btn 
                text 
                @click="showBreakModalComputed = false"
                block
              >
                Cancel
              </v-btn>
            </v-col>
          </v-row>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Go on Break Modal for Position logic -->
    <v-dialog v-else v-model="showBreakModalComputed" max-width="400px">
      <v-card>
        <v-card-title v-if="breakModalController">
          <template v-if="bothPositionsSet">
            {{ breakModalController.position }}: {{ breakModalController.name }} ({{ breakModalController.CID }})
          </template>
          <template v-else>
            {{ breakModalController.name }} ({{ breakModalController.CID }})
          </template>
        </v-card-title>
        <v-card-actions>
          <v-row no-gutters>
            <v-col cols="9">
              <v-btn 
                color="error" 
                @click="confirmBreak"
                block
              >
                Go on Break
              </v-btn>
            </v-col>
            <v-col cols="3">
              <v-btn 
                text 
                @click="showBreakModalComputed = false"
                block
              >
                Cancel
              </v-btn>
            </v-col>
          </v-row>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Go on Position Modal for CID logic -->
    <v-dialog v-if="searchType === 'CID'" v-model="showPositionModalComputed" max-width="400px">
      <v-card>
        <v-card-title>{{ matchedControllers[0]?.name }} ({{ settings.cid1 }})</v-card-title>
        <v-card-text>
          <v-form>
            <v-text-field 
              v-model="enteredCallsign" 
              label="Callsign"
              autofocus
            ></v-text-field>
            <p v-if="!hasCIDSpecified">No CID has been specified, check settings</p>
            <p v-else-if="!isControllerFound">Controller not found, sign in to PLS first.</p>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn 
            color="blue" 
            @click="confirmPositionCID" 
            :disabled="!enteredCallsign || !hasCIDSpecified || !isControllerFound"
          >
            Go on Position
          </v-btn>
          <v-btn text @click="showPositionModalComputed = false">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Go on Position Modal for Position logic -->
    <v-dialog v-else v-model="showPositionModalComputed" max-width="400px">
      <v-card>
        <v-card-text>
          <v-form>
            <v-text-field v-model="enteredCID" label="CID" autofocus></v-text-field>
            <p v-if="matchingController">{{ matchingController.name }} found</p>
            <p v-else-if="enteredCID">Controller not found, sign in to PLS first.</p>
            <v-text-field 
              v-if="matchingController" 
              v-model="enteredCallsign" 
              label="Callsign"
            ></v-text-field>
            <p v-if="!hasPositionSpecified">No position has been specified, check settings</p>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-row no-gutters>
            <v-col v-if="bothPositionsSet" cols="9">
              <v-row no-gutters>
                <v-col cols="12">
                  <v-btn 
                    color="blue" 
                    @click="confirmPosition(settings.position1)" 
                    :disabled="!matchingController || !hasPositionSpecified"
                    block
                  >
                    Go on Position ({{ settings.position1 }})
                  </v-btn>
                </v-col>
              </v-row>
              <v-row no-gutters>
                <v-col cols="12">
                  <v-btn 
                    color="blue" 
                    @click="confirmPosition(settings.position2)" 
                    :disabled="!matchingController || !hasPositionSpecified"
                    block
                  >
                    Go on Position ({{ settings.position2 }})
                  </v-btn>
                </v-col>
              </v-row>
            </v-col>
            <v-col v-else cols="9">
              <v-btn 
                color="blue" 
                @click="confirmPosition()" 
                :disabled="!matchingController || !hasPositionSpecified"
                block
              >
                Go on Position
              </v-btn>
            </v-col>
            <v-col cols="3">
              <v-btn 
                text 
                @click="showPositionModalComputed = false"
                style="height: 100%"
                block
              >
                Cancel
              </v-btn>
            </v-col>
          </v-row>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue"
import axios from "axios"
import moment from "moment"
import useEventBus from "@/eventbus"
import { useSettingsStore } from "@/stores/settings"
import { useAuthStore } from "@/stores/auth"

const settings = useSettingsStore()
const auth = useAuthStore()
const bus = useEventBus()

const searchType = ref(settings.plsLogic)
const searchValues = ref<string[][]>([[], []])
const sessionLengths = ref(["00:00:00", "00:00:00"])
const matchedControllers = ref<any[][]>([[], []])
const loading = ref(true)
const statusSuffixes = ref(["", ""])

let intervalIds: (number | null)[] = [null, null]
let refreshIntervalId: number | null = null

const showBreakModal = ref(false)
const breakModalController = ref(null)
const showPositionModal = ref(false)

const activeControllers = ref([])
const controllerNames = ref([])
const awayControllers = ref([])

// Add these to your reactive variables
const enteredCID = ref("")
const enteredCallsign = ref("")
const matchingController = ref<Controller | null>(null)

const bothPositionsSet = computed(() => 
  settings.position1 !== '' && settings.position2 !== ''
)

// Add this computed property
const hasPositionSpecified = computed(() => {
  return settings.position1 !== '' || settings.position2 !== '';
})

// Add these computed properties
const hasCIDSpecified = computed(() => {
  return settings.cid1 !== '' || settings.cid2 !== '';
})

const isControllerFound = ref(false)

// Function to fetch and filter controllers
async function fetchSessionData() {
  if (!settings.enablePLS) return

  loading.value = true
  try {
    const response = await axios.get("http://localhost:3001/api/controllers")
    const controllers = [
      ...response.data.activeControllers,
      ...response.data.availableControllers,
      ...response.data.awayControllers,
    ]

    matchedControllers.value = [[], []]
    statusSuffixes.value = ["", ""]

    for (let i = 0; i < 2; i++) {
      if (searchValues.value[i].length > 0) {
        if (searchType.value === "CID") {
          matchedControllers.value[i] = controllers.filter((controller: any) =>
            searchValues.value[i].includes(controller.CID)
          )
        } else {
          matchedControllers.value[i] = controllers.filter((controller: any) =>
            searchValues.value[i].includes(controller.position)
          )
        }

        if (matchedControllers.value[i].length > 0) {
          const matchedController = matchedControllers.value[i][0]
          if (response.data.activeControllers.some(c => c.CID === matchedController.CID)) {
            statusSuffixes.value[i] = ""
          } else if (response.data.availableControllers.some(c => c.CID === matchedController.CID)) {
            statusSuffixes.value[i] = "P"
          } else if (response.data.awayControllers.some(c => c.CID === matchedController.CID)) {
            statusSuffixes.value[i] = "\u00D6"
          }

          const timestamp = matchedController.timestamp
          const sessionStart = moment(timestamp)
          startUpdatingSessionLength(sessionStart, i)
        } else {
          resetTimer(i)
        }
      } else {
        resetTimer(i)
      }
    }
  } catch (error) {
    console.error("Error fetching session data:", error)
  } finally {
    loading.value = false
  }
}

function resetTimer(index: number) {
  sessionLengths.value[index] = "00:00:00"
  statusSuffixes.value[index] = ""
  if (intervalIds[index] !== null) {
    clearInterval(intervalIds[index]!)
    intervalIds[index] = null
  }
}

function startUpdatingSessionLength(sessionStart: moment.Moment, index: number) {
  if (intervalIds[index] !== null) {
    clearInterval(intervalIds[index]!)
  }

  intervalIds[index] = setInterval(() => {
    const now = moment()
    const duration = moment.duration(now.diff(sessionStart))
    sessionLengths.value[index] = `${String(duration.hours()).padStart(2, "0")}:${String(
      duration.minutes()
    ).padStart(2, "0")}:${String(duration.seconds()).padStart(2, "0")}`
  }, 1000)
}

// Function to set up auto-refresh every 10 seconds
function startAutoRefresh() {
  if (refreshIntervalId !== null) {
    clearInterval(refreshIntervalId)
  }

  refreshIntervalId = setInterval(() => {
    fetchSessionData()
  }, 10000)
}

// Clear interval when component is unmounted
onBeforeUnmount(() => {
  for (let i = 0; i < 2; i++) {
    if (intervalIds[i] !== null) {
      clearInterval(intervalIds[i]!)
    }
  }
  if (refreshIntervalId !== null) {
    clearInterval(refreshIntervalId)
  }
})

// Update PLS logic when settings change
watch(() => settings.plsLogic, (newValue) => {
  if (settings.enablePLS) {
    searchType.value = newValue
    updateSearchValue()
  }
})

watch(() => settings.enablePLS, (newValue: boolean) => {
  if (newValue) {
    updateSearchValue()
    fetchSessionData()
    startAutoRefresh()
  } else {
    sessionLengths.value = ["00:00:00", "00:00:00"]
    statusSuffixes.value = ["", ""]
    matchedControllers.value = [[], []]
    for (let i = 0; i < 2; i++) {
      if (intervalIds[i] !== null) {
        clearInterval(intervalIds[i]!)
      }
    }
    if (refreshIntervalId !== null) {
      clearInterval(refreshIntervalId)
    }
  }
})

function updateSearchValue() {
  if (!settings.enablePLS) return

  if (searchType.value === "CID") {
    if (settings.useVatsimConnect && auth.user) {
      searchValues.value = [[auth.user.cid.toString()], []]
    } else {
      searchValues.value = [[settings.cid1], [settings.cid2]].map(arr => arr.filter(Boolean))
    }
  } else {
    searchValues.value = [[settings.position1], [settings.position2]].map(arr => arr.filter(Boolean))
  }
  fetchSessionData()
}

// Fetch data and start auto-refresh when component is mounted
onMounted(() => {
  if (settings.enablePLS) {
    updateSearchValue()
    fetchSessionData()
    startAutoRefresh()
  }

  bus.on("refresh", () => {
    if (settings.enablePLS) {
      fetchSessionData()
    }
  })

  bus.on("logicChanged", ({ type, value }: { type: string; value: string[] }) => {
    if (settings.enablePLS) {
      searchType.value = type
      searchValues.value = value.map(arr => arr.split(','))
      fetchSessionData()
    }
  })
})

// Listen for changes in settings and update accordingly
watch(() => settings.enablePLS, (newValue) => {
  if (newValue) {
    updateSearchValue()
    fetchSessionData()
    startAutoRefresh()
  } else {
    sessionLengths.value = ["00:00:00", "00:00:00"]
    statusSuffixes.value = ["", ""]
    matchedControllers.value = [[], []]
    for (let i = 0; i < 2; i++) {
      if (intervalIds[i] !== null) {
        clearInterval(intervalIds[i]!)
      }
    }
    if (refreshIntervalId !== null) {
      clearInterval(refreshIntervalId)
    }
  }
})

watch(() => settings.plsLogic, () => {
  if (settings.enablePLS) {
    updateSearchValue()
  }
})

watch(() => settings.useVatsimConnect, () => {
  if (settings.enablePLS && searchType.value === "CID") {
    updateSearchValue()
  }
})

watch([() => settings.cid1, () => settings.cid2], () => {
  if (settings.enablePLS && searchType.value === "CID" && !settings.useVatsimConnect) {
    updateSearchValue()
  }
})

watch([() => settings.position1, () => settings.position2], () => {
  if (settings.enablePLS && searchType.value === "POSITION") {
    updateSearchValue()
  }
})

// Modify the watch effect for settings.cid1 to correctly check if the controller is found
watch(() => settings.cid1, async (newCID) => {
  if (newCID) {
    try {
      const response = await axios.get("http://localhost:3001/api/controllers")
      const { activeControllers, availableControllers, awayControllers } = response.data
      
      isControllerFound.value = [
        ...activeControllers,
        ...availableControllers,
        ...awayControllers
      ].some(controller => controller.CID === newCID)
    } catch (error) {
      console.error("Error fetching controllers:", error)
      isControllerFound.value = false
    }
  } else {
    isControllerFound.value = false
  }
})

// Modify the confirmPosition function to accept a position parameter
async function confirmPosition(position?: string) {
  if (matchingController.value) {
    try {
      // Fetch the current state from the server
      const response = await axios.get("http://localhost:3001/api/controllers")
      const currentData = response.data

      // Determine which position to use
      const selectedPosition = position || settings.position1 || settings.position2

      // Create an updated version of the controller
      const updatedController = {
        ...matchingController.value,
        position: selectedPosition,
        callsign: enteredCallsign.value || selectedPosition, // Use entered callsign if available
        timestamp: new Date().toISOString()
      }

      // Update the controller lists
      const newActiveControllers = [...currentData.activeControllers, updatedController]
      const newAvailableControllers = currentData.availableControllers.filter(c => c.CID !== updatedController.CID)
      const newAwayControllers = currentData.awayControllers.filter(c => c.CID !== updatedController.CID)

      // Send the updated data to the server
      await axios.post("http://localhost:3001/api/controllers", {
        activeControllers: newActiveControllers,
        availableControllers: newAvailableControllers,
        awayControllers: newAwayControllers,
        moved: updatedController
      })

      // Refresh the data after successful update
      fetchSessionData()

      // Reset the form
      enteredCID.value = ""
      enteredCallsign.value = ""
      matchingController.value = null

      // Close the modal and reset fields
      showPositionModalComputed.value = false
    } catch (error) {
      console.error("Error updating controller status:", error)
      if (axios.isAxiosError(error) && error.response) {
        console.error("Server response:", error.response.data)
      }
    }
  }
}

async function confirmBreak() {
  if (breakModalController.value) {
    try {
      // Fetch the current state from the server
      const response = await axios.get("http://localhost:3001/api/controllers");
      const currentData = response.data;

      // Create an updated version of the controller
      const updatedController = {
        ...breakModalController.value,
        position: "",
        callsign: "",
        timestamp: new Date().toISOString()
      };

      // Update the controller lists
      const newActiveControllers = currentData.activeControllers.filter(c => c.CID !== breakModalController.value.CID);
      const newAvailableControllers = [...currentData.availableControllers, updatedController];

      // Send the updated data to the server
      await axios.post("http://localhost:3001/api/controllers", {
        activeControllers: newActiveControllers,
        availableControllers: newAvailableControllers,
        awayControllers: currentData.awayControllers,
        moved: updatedController
      });

      // Refresh the data after successful update
      fetchSessionData();
    } catch (error) {
      console.error("Error updating controller status:", error);
      if (axios.isAxiosError(error) && error.response) {
        console.error("Server response:", error.response.data);
      }
    }
  }
  showBreakModalComputed.value = false;
  breakModalController.value = null;
}

// Update the function to handle the session timer click
function handleSessionTimerClick(index: number) {
  if (matchedControllers.value[index].length > 0) {
    if (searchType.value === 'CID' && statusSuffixes.value[index] === '') {
      breakModalController.value = matchedControllers.value[index][0]
      showBreakModal.value = true
    }
    if (searchType.value === 'Position') {
      breakModalController.value = matchedControllers.value[index][0]
      showBreakModal.value = true
    }
  }
}

// Update the function to handle going on position for CID logic
async function confirmPositionCID() {
  if (!hasCIDSpecified.value || !isControllerFound.value) {
    return
  }

  try {
    // Fetch the current state from the server
    const response = await axios.get("http://localhost:3001/api/controllers")
    const currentData = response.data

    // Find the existing controller data
    const existingController = currentData.availableControllers.find(c => c.CID === settings.cid1) ||
                               currentData.awayControllers.find(c => c.CID === settings.cid1)

    if (!existingController) {
      console.error("Controller not found in available or away lists")
      return
    }

    // Create an updated version of the controller
    const updatedController = {
      ...existingController,  // This preserves all existing data, including "sign" and "rating"
      CID: settings.cid1,
      name: matchedControllers.value[0]?.name,
      position: "Online",
      callsign: enteredCallsign.value,
      timestamp: new Date().toISOString()
    }

    // Update the controller lists
    const newActiveControllers = [...currentData.activeControllers, updatedController]
    const newAvailableControllers = currentData.availableControllers.filter(c => c.CID !== updatedController.CID)
    const newAwayControllers = currentData.awayControllers.filter(c => c.CID !== updatedController.CID)

    // Send the updated data to the server
    await axios.post("http://localhost:3001/api/controllers", {
      activeControllers: newActiveControllers,
      availableControllers: newAvailableControllers,
      awayControllers: newAwayControllers,
      moved: updatedController
    })

    // Refresh the data after successful update
    fetchSessionData()

    // Reset the form
    enteredCallsign.value = ""

    // Close the modal
    showPositionModalComputed.value = false
  } catch (error) {
    console.error("Error updating controller status:", error)
    if (axios.isAxiosError(error) && error.response) {
      console.error("Server response:", error.response.data)
    }
  }
}

// Update the getTooltipText function
function getTooltipText(index: number) {
  if (matchedControllers.value[index].length === 0) return ''
  
  const controller = matchedControllers.value[index][0]
  let tooltipText = ''

  if (searchType.value === 'CID') {
    tooltipText = controller.callsign || `${controller.name} (${controller.CID})`
  } else {
    tooltipText = `${controller.name} (${controller.CID})`
  }

  // Add position prefix if both positions are set
  if (bothPositionsSet.value) {
    const position = index === 0 ? settings.position1 : settings.position2
    tooltipText = `${position}: ${tooltipText}`
  }

  return tooltipText
}

// Add this function to reset modal fields
function resetModalFields() {
  enteredCID.value = ""
  enteredCallsign.value = ""
  matchingController.value = null
}

// Update the showPositionModal ref to use a getter and setter
const showPositionModalComputed = computed({
  get: () => showPositionModal.value,
  set: (value) => {
    showPositionModal.value = value
    if (!value) {
      resetModalFields()
    }
  }
})

// Update the showBreakModal ref similarly
const showBreakModalComputed = computed({
  get: () => showBreakModal.value,
  set: (value) => {
    showBreakModal.value = value
    if (!value) {
      breakModalController.value = null
    }
  }
})
</script>

