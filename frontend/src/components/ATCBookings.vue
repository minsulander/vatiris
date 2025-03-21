<template>
  <div class="bookings-container" ref="div">
    <!-- Data Table -->
    <div class="table-container">
      <table v-if="!error && filteredBookings.length > 0">
        <thead>
          <tr>
            <th @click="sortBy('callsign')">Position</th>
            <th @click="sortBy('today')">{{ todayDate }}</th>
            <th @click="sortBy('tomorrow')">{{ tomorrowDate }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="position in sortedBookings" :key="position.callsign">
            <td>{{ getPositionName(position.callsign) }}</td>
            <td>
              <template v-for="(booking, index) in getTodayBookings(position.callsign)" :key="index">
                {{ formatTimeRange(booking) }}<br v-if="index < getTodayBookings(position.callsign).length - 1">
              </template>
            </td>
            <td>
              <template v-for="(booking, index) in getTomorrowBookings(position.callsign)" :key="index">
                {{ formatTimeRange(booking) }}<br v-if="index < getTomorrowBookings(position.callsign).length - 1">
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="loading">Loading...</div>
      <div v-else-if="error">{{ error }}</div>
      <div v-else-if="filteredBookings.length === 0" class="pa-2">No bookings found</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import moment from 'moment'
import { getPositionName } from '../data/positions'

const props = defineProps<{ src?: string }>()
const div = ref()

const bookings = ref([] as any[])
const loading = ref(true)
const error = ref(null as string | null)
const sortKey = ref('today') // Default sort by today's bookings
const sortOrder = ref(1) // 1 for ascending, -1 for descending

const todayDate = computed(() => moment().utc().format('YYYY-MM-DD'))
const tomorrowDate = computed(() => moment().add(1, 'days').utc().format('YYYY-MM-DD'))

// Filter bookings to only show positions that have bookings in the displayed dates
const filteredBookings = computed(() => {
  return bookings.value.filter(position => {
    const hasToday = getTodayBookings(position.callsign).length > 0
    const hasTomorrow = getTomorrowBookings(position.callsign).length > 0
    return hasToday || hasTomorrow
  })
})

// Sort positions based on the selected column
const sortedBookings = computed(() => {
  return [...filteredBookings.value].sort((a, b) => {
    if (sortKey.value === 'callsign') {
      return sortOrder.value * a.callsign.localeCompare(b.callsign)
    }
    
    const aToday = getTodayBookings(a.callsign)
    const bToday = getTodayBookings(b.callsign)
    const aTomorrow = getTomorrowBookings(a.callsign)
    const bTomorrow = getTomorrowBookings(b.callsign)

    if (sortKey.value === 'today') {
      const aTime = aToday.length > 0 ? aToday[0].start_time : null
      const bTime = bToday.length > 0 ? bToday[0].start_time : null
      
      if (!aTime && !bTime) return 0
      if (!aTime) return sortOrder.value
      if (!bTime) return -sortOrder.value
      return sortOrder.value * moment.utc(aTime).diff(moment.utc(bTime))
    }
    
    if (sortKey.value === 'tomorrow') {
      const aTime = aTomorrow.length > 0 ? aTomorrow[0].start_time : null
      const bTime = bTomorrow.length > 0 ? bTomorrow[0].start_time : null
      
      if (!aTime && !bTime) return 0
      if (!aTime) return sortOrder.value
      if (!bTime) return -sortOrder.value
      return sortOrder.value * moment.utc(aTime).diff(moment.utc(bTime))
    }

    return 0
  })
})

function sortBy(key: string) {
  if (sortKey.value === key) {
    // If clicking the same column, reverse the sort order
    sortOrder.value *= -1
  } else {
    // If clicking a different column, set it as the new sort key and reset order to ascending
    sortKey.value = key
    sortOrder.value = 1
  }
}

function getEarliestTime(todayBookings: any[], tomorrowBookings: any[]) {
  const times = []
  
  if (todayBookings.length > 0) {
    times.push(...todayBookings.map(b => b.start_time))
  }
  
  if (tomorrowBookings.length > 0) {
    times.push(...tomorrowBookings.map(b => b.start_time))
  }
  
  return times.length > 0 ? times.reduce((earliest, current) => 
    moment.utc(current).isBefore(moment.utc(earliest)) ? current : earliest
  ) : null
}

interface Booking {
  id: number;
  cid: number;
  type: string;
  callsign: string;
  start: string;
  end: string;
  division: string;
  subdivision: string | null;
}

async function fetchBookings() {
  try {
    loading.value = true
    
    let rawBookings: Booking[]
    
    const response = await axios.get('https://api.vatiris.se/bookings')
    rawBookings = response.data
    
    const swedishBookings = rawBookings.filter(booking => 
      booking.callsign.match(/^ES[A-Z]{2}_/)
    )
    
    const groupedBookings = swedishBookings.reduce((acc, booking) => {
      const position = booking.callsign
      if (!acc.find(b => b.callsign === position)) {
        acc.push({ callsign: position, bookings: [] })
      }
      const positionGroup = acc.find(b => b.callsign === position)
      positionGroup?.bookings.push({
        start_time: booking.start,
        end_time: booking.end
      })
      return acc
    }, [] as Array<{ callsign: string, bookings: any[] }>)
    
    bookings.value = groupedBookings.sort((a, b) => a.callsign.localeCompare(b.callsign))
    loading.value = false
  } catch (err) {
    console.error('Error fetching bookings:', err)
    error.value = 'Failed to load ATC bookings. Please try again later.'
    loading.value = false
  }
}

function getTodayBookings(callsign: string) {
  const position = bookings.value.find(b => b.callsign === callsign)
  if (!position) return []
  return position.bookings
    .filter((booking: any) => moment.utc(booking.start_time).format('YYYY-MM-DD') === todayDate.value)
    .sort((a: any, b: any) => moment.utc(a.start_time).diff(moment.utc(b.start_time))) // Sort by start time
}

function getTomorrowBookings(callsign: string) {
  const position = bookings.value.find(b => b.callsign === callsign)
  if (!position) return []
  return position.bookings
    .filter((booking: any) => moment.utc(booking.start_time).format('YYYY-MM-DD') === tomorrowDate.value)
    .sort((a: any, b: any) => moment.utc(a.start_time).diff(moment.utc(b.start_time))) // Sort by start time
}

function formatTimeRange(booking: any) {
  const start = moment.utc(booking.start_time).format('HH:mm')
  const end = moment.utc(booking.end_time).format('HH:mm')
  return `${start} - ${end}`
}

onMounted(() => {
  fetchBookings()
})

// Add watch for div to handle external link
watch(div, (newValue, oldValue) => {
    if (div.value && !oldValue) {
        const winbox = div.value.closest(".winbox")
        if (winbox) {
            const title = winbox.querySelector(".wb-title")
            if (title && !title.innerHTML.includes("mdi-open-in-new")) {
                title.innerHTML += ` <a href="https://cc.vatsim-scandinavia.org/booking" target="_blank" style="color: #ddd"><span class="mdi mdi-open-in-new"></span></a> `
            }
        }
    }
})
</script>

<style scoped>
.bookings-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-container {
  flex-grow: 1;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  position: sticky;
  top: 0;
  background-color: #9E9E9E;
  z-index: 5;
}

th {
  cursor: pointer;
  background-color: #9E9E9E;
  color: #ffffff;
  padding: 6px;
  text-align: left;
  font-weight: bold;
}

th:hover {
  background-color: #8E8E8E;
}

td {
  padding: 6px;
  font-size: 14px;
}

tbody tr:nth-child(even) {
  background-color: #f9f9f9;
}
</style> 