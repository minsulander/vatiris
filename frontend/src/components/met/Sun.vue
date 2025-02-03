<template>
    <div class="sunrise-sunset">
        <div class="pa-3">
            <div class="info-row">
                <div class="time-info">
                    <div v-if="isNightTime">
                        <strong>Sunrise:</strong><br />
                        {{ dawnTime }}
                    </div>
                    <div v-else>
                        <strong>Sunset:</strong><br />
                        {{ sunsetTime }}
                    </div>
                    <div v-if="isNightTime">
                        <strong>Day:</strong><br />
                        {{ sunriseTime }}
                    </div>
                    <div v-else>
                        <strong>Night:</strong><br />
                        {{ duskTime }}
                    </div>
                </div>
                <div class="airport-info">
                    <h1 class="airport-code">{{ airportCode }}</h1>
                    <div v-if="isNightTime">
                        <p class="nighttext"><strong>Separation VFR</strong></p>
                    </div>
                    <div v-else-if="isDuskTime">
                        <p class="nighttext">Night: {{ duskTime }}</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from "vue"
import * as SunCalc from "suncalc"
import Papa from "papaparse"
import airportsData from "@/data/airports.csv?raw"

const props = defineProps<{ id: string }>()

const airportCode = ref(props.id)
const dawnTime = ref("")
const duskTime = ref("")
const sunriseTime = ref("")
const sunsetTime = ref("")
const loading = ref(false)
const error = ref("")
const isNightTime = ref(false)
const isDuskTime = ref(false)
const currentTime = ref("")

const airports = ref<Record<string, { lat: number; lon: number }>>({})

const loadAirports = () => {
    try {
        const results = Papa.parse(airportsData, { header: true })

        results.data.forEach((airport: any) => {
            if (airport.ident) {
                airports.value[airport.ident.toUpperCase()] = {
                    lat: parseFloat(airport.latitude_deg),
                    lon: parseFloat(airport.longitude_deg),
                }
            }
        })
    } catch (err) {
        console.error("Error loading airports data:", err)
        error.value = "Failed to load airports data"
    }
}

//Is this relevant..?
const calculateAeronauticalTimes = (lat: number, date: Date, sunrise: Date, sunset: Date) => {
    const absLat = Math.abs(lat)
    let dayStart: Date, nightStart: Date

    if (absLat >= 30 && absLat <= 60) {
        dayStart = new Date(sunrise.getTime() - 30 * 60000)
        nightStart = new Date(sunset.getTime() + 30 * 60000)
    } else if (absLat >= 0 && absLat < 30) {
        dayStart = new Date(sunrise.getTime() - 15 * 60000)
        nightStart = new Date(sunset.getTime() + 15 * 60000)
    } else {
        // For latitudes outside 0-60 range, use standard sunrise/sunset
        dayStart = sunrise
        nightStart = sunset
    }

    return { dayStart, nightStart }
}

const formatTime = (date: Date): string => {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

const calculateSunriseSunset = () => {
    if (!airportCode.value) return

    loading.value = true
    error.value = ""

    const airport = airports.value[airportCode.value.toUpperCase()]

    if (!airport) {
        error.value = "Airport not found"
        loading.value = false
        return
    }

    try {
        const { lat, lon } = airport
        const date = new Date()
        const times = SunCalc.getTimes(date, lat, lon)

        dawnTime.value = formatTime(times.dawn)
        duskTime.value = formatTime(times.dusk)
        sunriseTime.value = formatTime(times.sunrise) || "N/A, no sunrise."
        sunsetTime.value = formatTime(times.sunset) || "N/A, no sunset."

        const { dayStart, nightStart } = calculateAeronauticalTimes(
            lat,
            date,
            times.sunrise,
            times.sunset,
        )

        const currentDateTime = new Date()
        isNightTime.value = currentDateTime >= nightStart || currentDateTime < dayStart
        isDuskTime.value = currentDateTime >= times.sunset && currentDateTime <= times.dusk
        currentTime.value = formatTime(currentDateTime)


        // Ensure dawnTime and sunriseTime are always set
        dawnTime.value = formatTime(times.dawn)
        sunriseTime.value = formatTime(times.sunrise)
    } catch (err) {
        console.error("Error calculating sunrise/sunset times:", err)
        error.value = "Failed to calculate sunrise/sunset times"
    } finally {
        loading.value = false
    }
}

watch(
    () => props.id,
    (newId) => {
        airportCode.value = newId
        calculateSunriseSunset()
    },
)

let recalculateInterval: any = undefined
onMounted(() => {
    loadAirports()
    calculateSunriseSunset()
    recalculateInterval = setInterval(() => {
        calculateSunriseSunset()
    }, 60000)
})

onUnmounted(() => {
    clearInterval(recalculateInterval)
})
</script>

<style scoped>
.sunrise-sunset {
    font-family: Arial, sans-serif;
}

.airport-code {
    font-size: 3em;
    font-weight: bold;
    margin: 0;
}

.info-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
}

.time-info {
    width: 60px; /* Fixed width for the left column */
    text-align: center;
}
.airport-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-right: 60px;
    text-align: center;
}

.nighttext {
    margin: 0;
    font-size: 1.2em;
}
</style>
