<template>
  <div v-if="settings.enablePLS">
    <span v-if="loading">-</span>
    <span v-else-if="matchedControllers.length > 0" class="text-grey" style="cursor: pointer">
    {{ sessionLength }} {{ statusSuffix }}
    </span>
    <v-btn
      icon
      class="text-grey"
      @click="showMenu = true"
    >
      <v-icon>{{ searchValue.length > 0 ? 'mdi-account' : 'mdi-account-outline' }}</v-icon>
      <v-menu v-model="showMenu" :close-on-content-click="false">
        <v-list class="text-grey">
          <v-list-item @click="goOnPause">
            <v-list-item-title>GO ON PAUSE</v-list-item-title>
          </v-list-item>
          <v-list-item @click="goOnPosition">
            <v-list-item-title>GO ON POSITION</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue"
import axios from "axios"
import moment from "moment"
import useEventBus from "@/eventbus"
import { useSettingsStore } from "@/stores/settings"
import { useAuthStore } from "@/stores/auth"

const settings = useSettingsStore()
const auth = useAuthStore()
const bus = useEventBus()

const searchType = ref(settings.plsLogic)
const searchValue = ref<string[]>([])
const sessionLength = ref("00:00:00")
const matchedControllers = ref<any[]>([])
const loading = ref(true)
const statusSuffix = ref("")

let intervalId: number | null = null
let refreshIntervalId: number | null = null

const showMenu = ref(false)

function goOnPause() {
  // Implement the logic for "Go on Pause" here
  showMenu.value = false
}

function goOnPosition() {
  // Implement the logic for "Go on Position" here
  showMenu.value = false
}

// Function to fetch and filter controllers
async function fetchSessionData() {
  if (!settings.enablePLS) {
    return
  }

  loading.value = true
  try {
    const response = await axios.get("http://localhost:3001/api/controllers")
    const controllers = [
      ...response.data.activeControllers,
      ...response.data.availableControllers,
      ...response.data.awayControllers,
    ]

    matchedControllers.value = []

    if (searchType.value === "CID") {
      matchedControllers.value = controllers.filter((controller: any) =>
        searchValue.value.includes(controller.CID)
      )
    } else {
      matchedControllers.value = controllers.filter((controller: any) =>
        searchValue.value.includes(controller.position)
      )
    }

    if (matchedControllers.value.length > 0) {
      const matchedController = matchedControllers.value[0]
      if (response.data.activeControllers.some(c => c.CID === matchedController.CID)) {
        statusSuffix.value = ""
      } else if (response.data.availableControllers.some(c => c.CID === matchedController.CID)) {
        statusSuffix.value = "P"
      } else if (response.data.awayControllers.some(c => c.CID === matchedController.CID)) {
        statusSuffix.value = "\u00D6"
      }

      const timestamp = matchedController.timestamp
      const sessionStart = moment(timestamp)
      startUpdatingSessionLength(sessionStart)
    } else {
      sessionLength.value = "00:00:00"
      statusSuffix.value = ""
      if (intervalId !== null) {
        clearInterval(intervalId)
      }
    }
  } catch (error) {
    console.error("Error fetching session data:", error)
  } finally {
    loading.value = false
  }
}

// Function to start updating session length in real-time
function startUpdatingSessionLength(sessionStart: moment.Moment) {
  if (intervalId !== null) {
    clearInterval(intervalId)
  }

  intervalId = setInterval(() => {
    const now = moment()
    const duration = moment.duration(now.diff(sessionStart))
    sessionLength.value = `${String(duration.hours()).padStart(2, "0")}:${String(
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
  if (intervalId !== null) {
    clearInterval(intervalId)
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
    sessionLength.value = "00:00:00"
    statusSuffix.value = ""
    matchedControllers.value = []
    if (intervalId !== null) {
      clearInterval(intervalId)
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
      searchValue.value = [auth.user.cid.toString()]
    } else {
      searchValue.value = [settings.cid1, settings.cid2].filter(Boolean)
    }
  } else {
    searchValue.value = [settings.position1, settings.position2].filter(Boolean)
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
      searchValue.value = value
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
    sessionLength.value = "00:00:00"
    statusSuffix.value = ""
    matchedControllers.value = []
    if (intervalId !== null) {
      clearInterval(intervalId)
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
</script>

