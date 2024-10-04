<template>
    <div>
      <span v-if="loading">-</span>
      <span v-else-if="matchedControllers.length > 0">
        ( PLS: {{ sessionLength }} )
      </span>
      <span v-else>( PLS: NIL )</span>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount } from "vue"
  import axios from "axios"
  import moment from "moment"
  import useEventBus from "@/eventbus"
  
  // Reactive data
  const searchType = ref("CID") // Default to "CID"
  const searchValue = ref([]) // Array of CIDs or positions to search for
  const sessionLength = ref("00:00:00")
  const matchedControllers = ref([])
  const matchedGroup = ref("") // Tracks which group the matched controller belongs to
  const loading = ref(true) // To track the loading state
  
  let intervalId = null // To keep track of the setInterval ID
  let refreshIntervalId = null // To keep track of the 10-second refresh interval
  
  const bus = useEventBus() // Event bus instance
  
  // Function to fetch and filter controllers
  async function fetchSessionData() {
    loading.value = true // Set loading to true when fetching data
    try {
      const response = await axios.get("http://localhost:3001/api/controllers")
      const controllers = [
        ...response.data.activeControllers,
        ...response.data.availableControllers,
        ...response.data.awayControllers,
      ]
  
      // Reset the matched group and controllers
      matchedControllers.value = []
      matchedGroup.value = ""
  
      // Filter controllers based on selected CID or Position
      if (searchType.value === "CID") {
        // Check activeControllers
        matchedControllers.value = response.data.activeControllers.filter(controller =>
          searchValue.value.includes(controller.CID)
        )
        if (matchedControllers.value.length > 0) {
          matchedGroup.value = "active"
        } else {
          // Check availableControllers if no match in active
          matchedControllers.value = response.data.availableControllers.filter(controller =>
            searchValue.value.includes(controller.CID)
          )
          if (matchedControllers.value.length > 0) {
            matchedGroup.value = "available"
          } else {
            // Check awayControllers if no match in active or available
            matchedControllers.value = response.data.awayControllers.filter(controller =>
              searchValue.value.includes(controller.CID)
            )
            if (matchedControllers.value.length > 0) {
              matchedGroup.value = "away"
            }
          }
        }
      } else {
        // Check for position match in all controller groups
        matchedControllers.value = response.data.activeControllers.filter(controller =>
          searchValue.value.includes(controller.position)
        )
        if (matchedControllers.value.length > 0) {
          matchedGroup.value = "active"
        } else {
          matchedControllers.value = response.data.availableControllers.filter(controller =>
            searchValue.value.includes(controller.position)
          )
          if (matchedControllers.value.length > 0) {
            matchedGroup.value = "available"
          } else {
            matchedControllers.value = response.data.awayControllers.filter(controller =>
              searchValue.value.includes(controller.position)
            )
            if (matchedControllers.value.length > 0) {
              matchedGroup.value = "away"
            }
          }
        }
      }
  
      // Calculate the session length if a match is found
      if (matchedControllers.value.length > 0) {
        const timestamp = matchedControllers.value[0].timestamp
        const sessionStart = moment(timestamp)
        startUpdatingSessionLength(sessionStart)
      } else {
        sessionLength.value = "00:00:00"
        clearInterval(intervalId)
      }
    } catch (error) {
      console.error("Error fetching session data:", error)
    } finally {
      loading.value = false // Set loading to false after fetching data
    }
  }
  
  // Function to start updating session length in real-time
  function startUpdatingSessionLength(sessionStart) {
    if (intervalId) {
      clearInterval(intervalId) // Clear any existing interval before starting a new one
    }
  
    intervalId = setInterval(() => {
      const now = moment()
      const duration = moment.duration(now.diff(sessionStart))
      let formattedTime = `${String(duration.hours()).padStart(2, "0")}:${String(
        duration.minutes()
      ).padStart(2, "0")}:${String(duration.seconds()).padStart(2, "0")}`
  
      // Append "P" or "Ö" depending on the matched group
      if (matchedGroup.value === "available") {
        formattedTime += " P"
      } else if (matchedGroup.value === "away") {
        formattedTime += " \u00D6" // Append Unicode character "Ö"
      }
  
      sessionLength.value = formattedTime
    }, 1000)
  }
  
  // Function to set up auto-refresh every 10 seconds
  function startAutoRefresh() {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId) // Clear any existing refresh interval
    }
  
    refreshIntervalId = setInterval(() => {
      fetchSessionData() // Refresh data every 10 seconds
    }, 10000)
  }
  
  // Clear interval when component is unmounted
  onBeforeUnmount(() => {
    if (intervalId) {
      clearInterval(intervalId)
    }
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId)
    }
  })
  
  // Fetch data and start auto-refresh when component is mounted
  onMounted(() => {
    fetchSessionData() // Initial fetch
    startAutoRefresh() // Start auto-refresh every 10 seconds
  
    // Listen for the "refresh" event from the event bus
    bus.on("refresh", () => {
      fetchSessionData() // Fetch data immediately on refresh event
    })
  
    // Listen for logic change event from About.vue
    bus.on("logicChanged", ({ type, value }) => {
      searchType.value = type
      searchValue.value = value
      fetchSessionData() // Fetch data based on the new logic
    })
  })
  </script>
  