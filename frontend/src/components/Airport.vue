<template>
  <div class="airport-container" @click="click">
    <!-- Filter Input -->
    <div class="sticky-header">
      <v-text-field
        ref="search"
        v-model="searchQuery"
        placeholder="Search" 
        variant="outlined"
        density="compact"
        clearable
        hide-details
        autofocus
        @keydown.esc="clearSearch"
        @click:clear="clearSearch"
      />
    </div>

    <!-- Data Table -->
    <div class="table-container">
      <table v-if="!error && columns.length > 0 && searchQuery && searchQuery.length >= 1">
        <thead>
          <tr>
            <th v-for="column in displayColumns" 
                :key="column" 
                @click="sortBy(column)"
                :title="getColumnHeaderTooltip(column)">
              {{ getColumnHeader(column) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="airport in sortedAirports" :key="airport.ICAO">
            <td v-for="column in displayColumns" 
                :key="column"
                :title="getColumnTooltip(airport, column)"
                v-html="getColumnValue(airport, column)">
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="loading">Loading...</div>
      <div v-else-if="error">{{ error }}</div>
      <div v-else-if="sortedAirports.length === 0 && searchQuery && searchQuery.length >= 1" 
           style="padding: 10px;">
        No records found
      </div>
      <div v-else-if="!searchQuery || searchQuery.length < 1" class="pa-2">
        Type at least 1 letter to start searching...
      </div>
    </div>
  </div>
</template>

<script>
import airportDataText from '@/data/ICAO_Airports.txt?raw';

export default {
  name: 'AirportSearch',
  
  data() {
    return {
      airportList: [],
      columns: ['ICAO', 'Name', 'City', 'Country', 'Elevation', 'Lat', 'Lon'],
      displayColumns: ['ICAO', 'Name', 'Country'],
      loading: true,
      error: null,
      sortKey: 'ICAO',
      sortOrder: 1,
      searchQuery: '',
    };
  },

  computed: {
    filteredAirports() {
      if (!this.searchQuery || this.searchQuery.length < 1) {
        return [];
      }

      const query = this.searchQuery.toLowerCase();
      const isExactSearch = query.length === 4;

      return this.airportList.filter(airport => 
        airport.searchText.includes(query)
      ).sort((a, b) => {
        // For 4-letter searches, prioritize ICAO matches
        if (isExactSearch) {
          const aICAO = a.ICAO.toLowerCase();
          const bICAO = b.ICAO.toLowerCase();
          
          // Exact ICAO match gets highest priority
          if (aICAO === query && bICAO !== query) return -1;
          if (bICAO === query && aICAO !== query) return 1;
          
          // ICAO starts with query gets second priority
          if (aICAO.startsWith(query) && !bICAO.startsWith(query)) return -1;
          if (bICAO.startsWith(query) && !aICAO.startsWith(query)) return 1;
        }

        // For other searches, prioritize matches in this order: ICAO, Name, Country
        const fields = ['ICAO', 'Name', 'Country'];
        for (const field of fields) {
          const aValue = String(a[field]).toLowerCase();
          const bValue = String(b[field]).toLowerCase();
          
          // Exact match gets highest priority
          if (aValue === query && bValue !== query) return -1;
          if (bValue === query && aValue !== query) return 1;
          
          // Starts with query gets second priority
          if (aValue.startsWith(query) && !bValue.startsWith(query)) return -1;
          if (bValue.startsWith(query) && !aValue.startsWith(query)) return 1;
        }

        // Default to alphabetical order by ICAO
        return a.ICAO.localeCompare(b.ICAO);
      }).slice(0, 200);
    },

    sortedAirports() {
      if (!this.sortKey || this.searchQuery.length === 4) {
        return this.filteredAirports;
      }
      
      return [...this.filteredAirports].sort((a, b) => {
        let fieldA = this.getColumnValue(a, this.sortKey) || '';
        let fieldB = this.getColumnValue(b, this.sortKey) || '';
        
        // Handle numeric values (like Elevation)
        if (this.sortKey === 'Elevation') {
          return (parseFloat(a.Elevation) - parseFloat(b.Elevation)) * this.sortOrder;
        }
        
        if (fieldA.toLowerCase() < fieldB.toLowerCase()) return -1 * this.sortOrder;
        if (fieldA.toLowerCase() > fieldB.toLowerCase()) return 1 * this.sortOrder;
        return 0;
      });
    }
  },

  created() {
    this.loadAirportData();
  },

  methods: {
    loadAirportData() {
      try {
        // Create a Windows-1252 decoder
        const decoder = new TextDecoder('windows-1252');
        
        // Convert the raw text to Uint8Array
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(airportDataText);
        
        // Decode using Windows-1252
        const decodedText = decoder.decode(uint8Array);
        const lines = decodedText.trim().split(/\r?\n/);

        const startIndex = lines.reduce((lastIndex, line, currentIndex) => {
          return line.startsWith(';====') ? currentIndex : lastIndex;
        }, -1);

        const dataLines = lines.slice(startIndex + 1);
        
        this.airportList = dataLines
          .filter(line => line.trim() && !line.startsWith(';'))
          .map(line => {
            const [ICAO, Name, Country, City, Elevation, Lat, Lon] = line.split('\t');
            const icaoCode = ICAO?.trim();
            // Skip if ICAO starts with a number or is empty
            if (!icaoCode || /^\d/.test(icaoCode)) {
              return null;
            }
            const name = Name?.trim()?.toUpperCase() || '';
            const country = Country?.trim()?.toUpperCase() || '';
            
            return {
              ICAO: icaoCode,
              Name: name,
              Country: country,
              searchText: `${icaoCode} ${this.normalizeText(name)} ${this.normalizeText(country)}`.toLowerCase()
            };
          })
          .filter(airport => airport !== null);

        if (this.airportList.length === 0) {
          throw new Error('No valid airport data found');
        }

        this.loading = false;
      } catch (err) {
        console.error('Error loading airport data:', err);
        this.error = `Failed to load airport data: ${err.message}. Check file encoding.`;
        this.loading = false;
      }
    },

    normalizeText(text) {
      return text
        .replace(/[Â‰·‡‚„]/gi, 'a')
        .replace(/[ˆÛÚÙı]/gi, 'o')
        .replace(/[ÈËÍÎ]/gi, 'e')
        .replace(/[≈]/g, 'A')
        .replace(/[ƒ]/g, 'A')
        .replace(/[÷]/g, 'O')
        .replace(/[…]/g, 'E');
    },

    sortBy(key) {
      if (this.sortKey === key) {
        this.sortOrder *= -1;
      } else {
        this.sortKey = key;
        this.sortOrder = 1;
      }
    },

    getColumnValue(airport, column) {
      if (!this.searchQuery || this.searchQuery.length < 1) {
        const value = airport[column] || '';
        return value;
      }
      
      const value = airport[column] || '';
      return this.highlightMatch(value);
    },

    highlightMatch(text) {
      if (!text) return '';
      
      const query = this.searchQuery.toLowerCase();
      const textLower = text.toLowerCase();
      
      if (!textLower.includes(query)) {
        return text;
      }
      
      const startIndex = textLower.indexOf(query);
      const endIndex = startIndex + query.length;
      
      const before = text.slice(0, startIndex);
      const match = text.slice(startIndex, endIndex);
      const after = text.slice(endIndex);
      
      return `${before}<strong>${match}</strong>${after}`;
    },

    getColumnHeader(column) {
      if (column === 'Lat') return 'Latitude';
      if (column === 'Lon') return 'Longitude';
      return column;
    },

    getColumnHeaderTooltip(column) {
      const tooltips = {
        'ICAO': 'ICAO Airport Code',
        'Elevation': 'Elevation in feet',
        'Lat': 'Latitude',
        'Lon': 'Longitude'
      };
      return tooltips[column] || '';
    },

    getColumnTooltip(airport, column) {
      if (column === 'Elevation') {
        return `${airport.Elevation} ft`;
      }
      if (column === 'Name') {
        return `${airport.Name} (${airport.ICAO})`;
      }
      return '';
    },

    clearSearch() {
      this.searchQuery = '';
      if (this.$refs.search) {
        this.$refs.search.focus();
      }
    },

    click() {
      if (this.$refs.search) {
        this.$refs.search.focus();
        this.$refs.search.select();
      }
    }
  }
};
</script>

<style scoped>
.airport-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sticky-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #9E9E9E;
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

td {
  padding: 6px;
  font-size: 14px;
}

tbody tr:nth-child(even) {
  background-color: #f9f9f9;
}

td :deep(strong) {
  font-weight: bold;
  color: #000;
  background-color: #ffeb3b40;
}
</style> 