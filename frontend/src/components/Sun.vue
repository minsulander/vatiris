<template>
    <div class="sunrise-sunset">
      <div class="pa-3">
        <div class="info-row">
          <div class="time-info">
            <div v-if="isNightTime">
              <strong>Sunrise:</strong><br> {{ dawnTime }}
            </div>
            <div v-else>
              <strong>Sunset:</strong><br> {{ sunsetTime }}
            </div>
            <div v-if="isNightTime">
              <strong>Day:</strong><br> {{ sunriseTime }}
            </div>
            <div v-else>
              <strong>Night:</strong><br> {{ duskTime }}
            </div>
          </div>
          <div class="airport-info">
            <h1 class="airport-code">{{ airportCode }}</h1>
            <p v-if="isNightTime" class="separation-vfr"><strong>Separation VFR</strong></p>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted, watch } from 'vue';
  import * as SunCalc from 'suncalc';
  import Papa from 'papaparse';
  import airportsData from '@/data/airports.csv?raw';

  const props = defineProps<{ id: string }>();

  const airportCode = ref(props.id);
  const dawnTime = ref('');
  const duskTime = ref('');
  const sunriseTime = ref('');
  const sunsetTime = ref('');
  const loading = ref(false);
  const error = ref('');
  const isNightTime = ref(false);

  const airports = ref<Record<string, { lat: number; lon: number }>>({});

  const loadAirports = () => {
    try {
      const results = Papa.parse(airportsData, { header: true });
      
      results.data.forEach((airport: any) => {
        if (airport.ident) {
          airports.value[airport.ident.toUpperCase()] = {
            lat: parseFloat(airport.latitude_deg),
            lon: parseFloat(airport.longitude_deg),
          };
        }
      });
    } catch (err) {
      console.error('Error loading airports data:', err);
      error.value = 'Failed to load airports data';
    }
  };

  //Is this relevant..?
  const calculateAeronauticalTimes = (lat: number, date: Date, sunrise: Date, sunset: Date) => {
    const absLat = Math.abs(lat);
    let dayStart: Date, nightStart: Date;

    if (absLat >= 30 && absLat <= 60) {
      dayStart = new Date(sunrise.getTime() - 30 * 60000);
      nightStart = new Date(sunset.getTime() + 30 * 60000);
    } else if (absLat >= 0 && absLat < 30) {
      dayStart = new Date(sunrise.getTime() - 15 * 60000);
      nightStart = new Date(sunset.getTime() + 15 * 60000);
    } else {
      // For latitudes outside 0-60 range, use standard sunrise/sunset
      dayStart = sunrise;
      nightStart = sunset;
    }

    return { dayStart, nightStart };
  };

  const formatTime = (date: Date): string => {
    return date.toUTCString().split(' ')[4].slice(0, -3);
  };

  const fetchSunriseSunset = () => {
    if (!airportCode.value) return;
    
    loading.value = true;
    error.value = '';
    
    const airport = airports.value[airportCode.value.toUpperCase()];
    
    if (!airport) {
      error.value = 'Airport not found';
      loading.value = false;
      return;
    }
    
    try {
      const { lat, lon } = airport;
      const date = new Date();
      const times = SunCalc.getTimes(date, lat, lon);
      
      dawnTime.value = formatTime(times.dawn);
      duskTime.value = formatTime(times.dusk);
      sunriseTime.value = formatTime(times.sunrise);
      sunsetTime.value = formatTime(times.sunset);

      const { dayStart, nightStart } = calculateAeronauticalTimes(lat, date, times.sunrise, times.sunset);

      const currentTime = new Date();
      isNightTime.value = currentTime >= nightStart || currentTime < dayStart;

      // Ensure dawnTime and sunriseTime are always set
      dawnTime.value = formatTime(times.dawn);
      sunriseTime.value = formatTime(times.sunrise);
    } catch (err) {
      console.error('Error calculating sunrise/sunset times:', err);
      error.value = 'Failed to calculate sunrise/sunset times';
    } finally {
      loading.value = false;
    }
  };

  watch(() => props.id, (newId) => {
    airportCode.value = newId;
    fetchSunriseSunset();
  });

  onMounted(() => {
    loadAirports();
    fetchSunriseSunset();
  });
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

  .separation-vfr {
    margin: 0;
    font-size: 1.2em;
  }
  </style>