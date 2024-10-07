<template>
    <div class="sunrise-sunset">
      <div class="pa-3">
        <input v-model="airportCode" @input="handleInput" placeholder="Enter ICAO airport code" class="airport-input" />
      </div>
      <div v-if="loading" class="pa-3 text-center">Loading...</div>
      <div v-else-if="error" class="pa-3 text-center text-error">{{ error }}</div>
      <div v-else class="pa-3">
        <h3>{{ airportCode }} Sunrise/Sunset Times (UTC)</h3>
        <div>Sunrise: {{ sunriseTime }}</div>
        <div>Sunset: {{ sunsetTime }}</div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted, watch } from 'vue';
  import axios from 'axios';
  
  const props = defineProps<{ id: string }>();
  
  const airportCode = ref(props.id);
  const sunriseTime = ref('');
  const sunsetTime = ref('');
  const loading = ref(false);
  const error = ref('');
  
  const fetchSunriseSunset = async () => {
    if (!airportCode.value) return;
    
    loading.value = true;
    error.value = '';
    
    try {
      // Fetch airport coordinates
      const airportResponse = await axios.get(`https://airportdb.io/api/v1/airport/${airportCode.value}`, {
        params: {
          apiToken: 'daf67f98f5da109fe0467952eefd4fc49fcc58bb29b5323a0e1e2bf3b92f9adff459f43e110aa2a3a2001296d3371778'
        }
      });
  
      const { latitude, longitude } = airportResponse.data;
  
      // Fetch sunrise/sunset times
      const sunriseSunsetResponse = await axios.get('https://api.sunrisesunset.io/json', {
        params: {
          lat: latitude,
          lng: longitude,
          timezone: 'UTC',
          time_format: '24'
        }
      });
  
      const { sunrise, sunset } = sunriseSunsetResponse.data.results;
      sunriseTime.value = sunrise;
      sunsetTime.value = sunset;
    } catch (err) {
      console.error('Error fetching sunrise/sunset data:', err);
      error.value = 'Failed to fetch sunrise/sunset data';
    } finally {
      loading.value = false;
    }
  };
  
  const handleInput = () => {
    if (airportCode.value.length === 4) {
      fetchSunriseSunset();
    }
  };
  
  watch(() => props.id, (newId) => {
    airportCode.value = newId;
    fetchSunriseSunset();
  });
  
  onMounted(() => {
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