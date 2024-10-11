<template>
    <div class="sunrise-sunset">
      <div class="pa-3">
        <input v-model="airportCode" @input="handleInput" placeholder="Enter airport identifier" class="airport-input" />
      </div>
      <div v-if="loading" class="pa-3 text-center">Loading...</div>
      <div v-else-if="error" class="pa-3 text-center text-error">{{ error }}</div>
      <div v-else class="pa-3">
        <h3>{{ airportCode }} Times (UTC)</h3>
        <div>Sunrise: {{ sunriseTime }}</div>
        <div>Sunset: {{ sunsetTime }}</div>
        <div>Aeronautical Day Start: {{ aeroDay }}</div>
        <div>Aeronautical Night Start: {{ aeroNight }}</div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted, watch } from 'vue';
  import * as SunCalc from 'suncalc';
  import Papa from 'papaparse';
  import airportsData from '@/data/airports.csv?raw';

  const props = withDefaults(defineProps<{ id?: string }>(), {
    id: ''
  });

  const airportCode = ref(props.id);
  const sunriseTime = ref('');
  const sunsetTime = ref('');
  const aeroDay = ref('');
  const aeroNight = ref('');
  const loading = ref(false);
  const error = ref('');

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
      
      sunriseTime.value = formatTime(times.sunrise);
      sunsetTime.value = formatTime(times.sunset);

      const { dayStart, nightStart } = calculateAeronauticalTimes(lat, date, times.sunrise, times.sunset);
      aeroDay.value = formatTime(dayStart);
      aeroNight.value = formatTime(nightStart);
    } catch (err) {
      console.error('Error calculating sunrise/sunset times:', err);
      error.value = 'Failed to calculate sunrise/sunset times';
    } finally {
      loading.value = false;
    }
  };

  const handleInput = () => {
    fetchSunriseSunset();
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
  
  .airport-input {
    width: 100%;
    padding: 8px;
    margin-bottom: 16px;
    font-size: 16px;
  }
  </style>