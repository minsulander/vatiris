<template>
  <div class="airline-container" @click="click">
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
      <table v-if="!error && columns.length > 0 && searchQuery && searchQuery.length >= 2">
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
          <tr v-for="airline in sortedAirlines" :key="airline.ICAO">
            <td v-for="column in displayColumns" 
                :key="column"
                :title="getColumnTooltip(airline, column)"
                v-html="getColumnValue(airline, column)">
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="loading">Loading...</div>
      <div v-else-if="error">{{ error }}</div>
      <div v-else-if="sortedAirlines.length === 0 && searchQuery && searchQuery.length >= 2" 
           style="padding: 10px;">
        No records found
      </div>
      <div v-else-if="!searchQuery || searchQuery.length < 2" class="pa-2">
        Type at least 2 letters to start searching...
      </div>
    </div>
  </div>
</template>

<script>
import airlineDataText from '@/data/ICAO_Airlines.txt?raw';
import milAirlineDataText from '@/data/MIL_Airlines.txt?raw';

export default {
  name: 'AirlineCallsign',
  
  data() {
    return {
      airlineList: [],
      columns: ['ICAO', 'Callsign', 'Operator', 'Country'],
      displayColumns: ['ICAO', 'Callsign', 'Operator', 'Country'],
      loading: true,
      error: null,
      sortKey: 'ICAO',
      sortOrder: 1,
      searchQuery: '',
    };
  },

  computed: {
    filteredAirlines() {
      if (!this.searchQuery || this.searchQuery.length < 2) {
        return [];
      }

      const query = this.searchQuery.toLowerCase();
      const isThreeLetterSearch = query.length === 3;

      return this.airlineList.filter(airline => 
        [airline.ICAO, airline.Callsign, airline.Operator].some(value => 
          String(value).toLowerCase().includes(query)
        )
      ).sort((a, b) => {
        // For 3-letter searches, prioritize ICAO matches
        if (isThreeLetterSearch) {
          const aICAO = a.ICAO.toLowerCase();
          const bICAO = b.ICAO.toLowerCase();
          
          // Exact ICAO match gets highest priority
          if (aICAO === query && bICAO !== query) return -1;
          if (bICAO === query && aICAO !== query) return 1;
          
          // ICAO starts with query gets second priority
          if (aICAO.startsWith(query) && !bICAO.startsWith(query)) return -1;
          if (bICAO.startsWith(query) && !aICAO.startsWith(query)) return 1;
          
          // Contains query in ICAO gets third priority
          if (aICAO.includes(query) && !bICAO.includes(query)) return -1;
          if (bICAO.includes(query) && !aICAO.includes(query)) return 1;
        }

        // For other searches, prioritize matches in this order: ICAO, Callsign, Operator
        const fields = ['ICAO', 'Callsign', 'Operator'];
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
      });
    },

    sortedAirlines() {
      if (!this.sortKey || this.searchQuery.length === 3) {
        return this.filteredAirlines; // Use the smart sorting for 3-letter searches
      }
      
      return [...this.filteredAirlines].sort((a, b) => {
        let fieldA = this.getColumnValue(a, this.sortKey) || '';
        let fieldB = this.getColumnValue(b, this.sortKey) || '';
        
        if (fieldA.toLowerCase() < fieldB.toLowerCase()) return -1 * this.sortOrder;
        if (fieldA.toLowerCase() > fieldB.toLowerCase()) return 1 * this.sortOrder;
        return 0;
      });
    }
  },

  created() {
    this.loadAirlineData();
  },

  methods: {
    loadAirlineData() {
      try {
        // Load both civilian and military airlines
        const civilianAirlines = this.parseAirlineFile(airlineDataText);
        const militaryAirlines = this.parseAirlineFile(milAirlineDataText);
        
        // Combine both lists
        this.airlineList = [...civilianAirlines, ...militaryAirlines];
        this.loading = false;
      } catch (err) {
        console.error('Error loading airline data:', err);
        this.error = 'Failed to load airline data. Please try again later.';
        this.loading = false;
      }
    },

    parseAirlineFile(fileContent) {
      const lines = fileContent.trim().split('\n');
      // Find the last separator line
      const startIndex = lines.reduce((lastIndex, line, currentIndex) => {
        return line.startsWith(';====') ? currentIndex : lastIndex;
      }, -1);

      // Only process lines after the last separator
      const dataLines = lines.slice(startIndex + 1);
      
      return dataLines
        .filter(line => line.trim() && !line.startsWith(';')) // Skip empty lines and comments
        .map(line => {
          const [ICAO, Airline, Callsign, Country] = line.split('\t');
          return {
            ICAO: ICAO?.trim(),
            Callsign: Callsign?.trim(),
            Operator: Airline?.trim(),
            Country: Country?.trim(),
            isMilitary: true // Add flag to identify military airlines
          };
        })
        .filter(airline => airline.ICAO); // Filter out any entries without ICAO code
    },

    sortBy(key) {
      if (this.sortKey === key) {
        this.sortOrder *= -1;
      } else {
        this.sortKey = key;
        this.sortOrder = 1;
      }
    },

    getColumnValue(airline, column) {
      if (!this.searchQuery || this.searchQuery.length < 2) {
        const value = airline[column] || '';
        // Add visual indicator for military airlines
        if (column === 'ICAO' && airline.isMilitary) {
          return `<span class="military">${value}</span>`;
        }
        return value;
      }
      
      const value = airline[column] || '';
      const highlighted = this.highlightMatch(value);
      
      // Add visual indicator for military airlines
      if (column === 'ICAO' && airline.isMilitary) {
        return `<span class="military">${highlighted}</span>`;
      }
      return highlighted;
    },

    highlightMatch(text) {
      if (!text) return '';
      
      const query = this.searchQuery.toLowerCase();
      const textLower = text.toLowerCase();
      
      // If no match, return original text
      if (!textLower.includes(query)) {
        return text;
      }
      
      const startIndex = textLower.indexOf(query);
      const endIndex = startIndex + query.length;
      
      // Create the three parts: before match, match, after match
      const before = text.slice(0, startIndex);
      const match = text.slice(startIndex, endIndex);
      const after = text.slice(endIndex);
      
      return `${before}<strong>${match}</strong>${after}`;
    },

    getColumnHeader(column) {
      return column;
    },

    getColumnHeaderTooltip(column) {
      const tooltips = {
        'ICAO': 'ICAO Airline Code',
        'Callsign': 'Radio Callsign',
      };
      return tooltips[column] || '';
    },

    getColumnTooltip(airline, column) {
      return ''; // Implement specific tooltips if needed
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
.airline-container {
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

/* Add styles for the highlighted text */
td :deep(strong) {
  font-weight: bold;
  color: #000;
  background-color: #ffeb3b40;
}

</style> 