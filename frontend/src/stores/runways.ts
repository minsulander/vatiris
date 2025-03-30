import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface RunwayData {
  airport_ident: string;
  le_ident: string;
  le_heading_degT: number;
  he_ident: string;
  he_heading_degT: number;
}

export const useRunwaysStore = defineStore('runways', () => {
  const runways = ref<RunwayData[]>([]);

  // Function to load and parse CSV data
  const loadRunways = async () => {
    try {
      const response = await fetch('/src/data/runways.csv');
      const csvText = await response.text();
      
      // Skip header row and parse CSV
      const rows = csvText.split('\n').slice(1);
      runways.value = rows
        .map(row => {
          const columns = row.split(',').map(col => col.replace(/"/g, ''));
          return {
            airport_ident: columns[2],
            le_ident: columns[8],
            le_heading_degT: parseFloat(columns[11]) || 0,
            he_ident: columns[13],
            he_heading_degT: parseFloat(columns[16]) || 0
          };
        })
        .filter(rwy => rwy.airport_ident && rwy.le_heading_degT && rwy.he_heading_degT);
    } catch (error) {
      console.error('Error loading runways:', error);
    }
  };

  // Get runways for a specific airport
  const getAirportRunways = (icao: string) => {
    return runways.value.filter(rwy => rwy.airport_ident === icao);
  };

  return {
    runways,
    loadRunways,
    getAirportRunways
  };
}); 