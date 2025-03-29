//TODO Clear search button (as in SApush)
<template>
  <div class="aircraft-container" @click="click">
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
      />
    </div>

    <!-- Data Table -->
    <div class="table-container">
      <table v-if="!error && columns.length > 0 && searchQuery && searchQuery.length >= 2">
        <thead>
          <tr>
            <th v-for="column in displayColumns" :key="column" @click="sortBy(column)" :title="getColumnHeaderTooltip(column)">
              {{ getColumnHeader(column) }}
            </th>
          </tr>
        </thead>
        <tbody>
        <tr v-for="aircraft in sortedAircraft" :key="aircraft.ICAO">
          <td v-for="column in displayColumns" :key="column" 
              :class="`column-${column}` + (isHighlightedWTC(aircraft, column) ? 'highlighted-wtc' : '')"
              :title="getColumnTooltip(aircraft, column)">
            {{ getColumnValue(aircraft, column) }}
          </td>
        </tr>
        </tbody>
      </table>

      <div v-if="loading">Loading...</div>
      <div v-else-if="error">{{ error }}</div>
      <div v-else-if="sortedAircraft.length === 0 && searchQuery && searchQuery.length >= 2" style="padding: 10px;">No records found</div>
      <div v-else-if="!searchQuery || searchQuery.length < 2" class="pa-2">
        Type at least 2 letters to start searching...
      </div>
    </div>
  </div>
</template>

<script>
import aircraftData from '@/data/ICAO_Aircraft.json';

export default {
  data() {
    return {
      aircraftList: [],
      columns: [],
      displayColumns: ['ICAO', 'Description', 'WTC', 'ARC', 'Wingspan', 'Length', 'Height', 'MTOW', 'Aircraft Type'],
      loading: true,
      error: null,
      sortKey: '',
      sortOrder: 1,
      searchQuery: '',
    };
  },
  computed: {
    filteredAircraft() {
      if (!this.searchQuery || this.searchQuery.length < 2) {
        return [];
      }
      return this.aircraftList.filter(aircraft => 
        [aircraft.ICAO, aircraft.Manufacturer, aircraft.Model].some(value => 
          String(value).toLowerCase().includes(this.searchQuery.toLowerCase())
        )
      );
    },
    aircraftWithARC() {
      return this.filteredAircraft.map(aircraft => ({
        ...aircraft,
        ARC: this.calculateARC(aircraft.Wingspan)
      }));
    },
    sortedAircraft() {
      return [...this.aircraftWithARC].sort((a, b) => {
        let fieldA = this.getColumnValue(a, this.sortKey);
        let fieldB = this.getColumnValue(b, this.sortKey);
        
        if (fieldA < fieldB) return -1 * this.sortOrder;
        if (fieldA > fieldB) return 1 * this.sortOrder;
        return 0;
      });
    }
  },
  created() {
    this.loadAircraftData();
  },
  methods: {
    loadAircraftData() {
      try {
        this.aircraftList = aircraftData;
        if (this.aircraftList.length > 0) {
          this.columns = Object.keys(this.aircraftList[0]);
        }
        this.loading = false;
      } catch (err) {
        console.error('Error loading aircraft data:', err);
        this.error = 'Failed to load aircraft data. Please try again later.';
        this.loading = false;
      }
    },
    sortBy(key) {
      if (this.sortKey === key) {
        this.sortOrder *= -1;
      } else {
        this.sortKey = key;
        this.sortOrder = 1;
      }
    },
    calculateARC(wingspan) {
      if (!wingspan) return '';
      const wingspanNum = parseFloat(wingspan);
      if (wingspanNum < 15) return 'A';
      if (wingspanNum < 24) return 'B';
      if (wingspanNum < 36) return 'C';
      if (wingspanNum < 52) return 'D';
      if (wingspanNum < 65) return 'E';
      if (wingspanNum < 80) return 'F';
      return 'F+';
    },
    getColumnValue(aircraft, column) {
      if (column === 'Aircraft Type') {
        return `${aircraft.Manufacturer} ${aircraft.Model}`;
      }
      if (column === 'ARC') {
        return this.calculateARC(aircraft.Wingspan);
      }
      if (['Wingspan', 'Length', 'Height'].includes(column)) {
        return aircraft[column] ? `${aircraft[column]} m` : '';
      }
      if (column === 'MTOW') {
        return aircraft[column] ? `${this.formatNumber(aircraft[column])} kg` : '';
      }
      if (column === 'WTC') {
        const highlightedValue = this.isHighlightedWTC(aircraft, column);
        return highlightedValue || aircraft[column] || '';
      }
      return aircraft[column] || '';
    },

    isHighlightedWTC(aircraft, column) {
      const specialTypes = {
        'B752': 'M/H',
        'B753': 'M/H',
        'T204': 'M/H'
      };
      if (column === 'WTC' && aircraft.ICAO in specialTypes) {
        return specialTypes[aircraft.ICAO];
      }
      return false;
    },
    getColumnHeader(column) {
      return column === 'Description' ? 'Descr.' : column;
    },

    formatNumber(number) {
      return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    },

    getColumnTooltip(aircraft, column) {
      if (column === 'WTC') {
        const highlightedValue = this.isHighlightedWTC(aircraft, column);
        if (highlightedValue) {
          const tooltips = {
            'M/H': 'Handled as "H" when preceeding aircraft.'
          };
          return tooltips[highlightedValue] || 'Special wake turbulence category';
        }
      } else if (column === 'Description') {
        return this.getDescriptionTooltip(aircraft.Description);
      }
      return ''; // Return empty string for other columns
    },

    getDescriptionTooltip(description) {
      if (!description) return '';

      const aircraftTypes = {
        L: 'Landplane',
        S: 'Seaplane',
        A: 'Amphibian',
        G: 'Gyrocopter',
        H: 'Helicopter',
        T: 'Tiltrotor'
      };

      const engineTypes = {
        J: 'Jet',
        T: 'Turboprop/Turboshaft',
        P: 'Piston',
        E: 'Electric',
        R: 'Rocket'
      };

      const [type, engineCount, engineType] = description.split('');
      
      if (aircraftTypes[type] && engineTypes[engineType]) {
        return `${aircraftTypes[type]} with ${engineCount} ${engineTypes[engineType]} engine(s)`;
      }

      return 'Unknown aircraft configuration';
    },

    getColumnHeaderTooltip(column) {
      const tooltips = {
        'WTC': 'Wake Turbulence Category',
        'ARC': 'Aerodrome Reference Code',
        'MTOW': 'Maximum Take-Off Weight',
        'Description': 'Aircraft type, number of engines, and engine type'
      };
      return tooltips[column] || '';
    },

    clearSearch() {
      this.searchQuery = '';
    },

    click() {
      this.$refs.search.focus()
      this.$refs.search.select()
    }
  }
};
</script>

<style scoped>
.aircraft-container {
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

table td.highlighted-wtc {
  background-color: #ffa500;
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

td.column-Wingspan,
td.column-Length,
td.column-Height,
td.column-MTOW {
  font-size: 12px;
  white-space: nowrap;
}

tbody tr:nth-child(even) {
  background-color: #f9f9f9;
}
</style>
