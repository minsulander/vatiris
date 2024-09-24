<template>
  <div>
    <!-- Filter Input and Toggle Buttons -->
    <div style="background-color: #9E9E9E; padding: 2px; display: flex; align-items: center;">
      <input 
        id="identifierFilter" 
        type="text" 
        v-model="identifierFilter" 
        placeholder="Filter identifier" 
        style="padding: 4px; border: none; border-radius: 4px;" 
      />

      <!-- Toggle Expired/Withdrawn -->
      <button 
        @click="toggleExpiredWithdrawn" 
        :style="{ 
          marginLeft: '4px', 
          color: showExpiredWithdrawn ? 'white' : 'red', 
          backgroundColor: showExpiredWithdrawn ? 'red' : 'transparent', 
          border: `1px solid red`, 
          padding: '4px 8px', 
          borderRadius: '4px'
        }"
      >
        Expired/Withdrawn
      </button>

      <!-- Toggle Notified -->
      <button 
        @click="toggleNotified" 
        :style="{ 
          marginLeft: '4px', 
          color: showNotified ? 'white' : 'orange', 
          backgroundColor: showNotified ? 'orange' : 'transparent', 
          border: `1px solid orange`, 
          padding: '4px 8px', 
          borderRadius: '4px'
        }"
      >
        Notified
      </button>

      <!-- Timestamp of API data -->
      <div style="margin-left: 12px; color: #616161">
        {{ formatTime(time) }}
      </div>
    </div>

    <!-- Data Table -->
    <table v-if="filteredFlowMeasures.length > 0 && !error">
      <thead>
        <tr>
          <th @click="sortBy('ident')">Identifier</th>
          <th @click="sortBy('starttime')">Start Time</th>
          <th @click="sortBy('endtime')">End Time</th>
          <th>Type</th>
          <th>Value</th>
          <th>Filters</th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="measure in filteredFlowMeasures" 
          :key="measure.ident"
          :style="{ color: isNotified(measure.starttime) || isExpired(measure.endtime) || isWithdrawn(measure.withdrawn_at) ? '#616161' : 'inherit' }"
        >
          <td 
            :style="{ 
              backgroundColor: 
                isActive(measure) ? 'green' : 
                isExpired(measure.endtime) ? 'red' : 
                isWithdrawn(measure.withdrawn_at) ? 'red' : 
                isNotified(measure.starttime) ? 'orange' : 
                'transparent' 
            }"
            :title="isActive(measure) ? 'Active' : 
                    isExpired(measure.endtime) ? 'Expired' : 
                    isWithdrawn(measure.withdrawn_at) ? 'Withdrawn' : 
                    isNotified(measure.starttime) ? 'Notified' : 
                    ''"
          >
            {{ measure.ident }}
          </td>
          <td>{{ formatTime(measure.starttime) }}</td>
          <td>{{ formatTime(measure.endtime) }}</td>
          <td :title="getTypeTooltip(measure.measure)">{{ getType(measure.measure) }}</td>
          <td>{{ getFormattedValue(measure.measure) }}</td>
          <td>{{ formatFilters(measure.filters) }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="loading">Loading...</div>
    <div v-else-if="filteredFlowMeasures.length === 0 && !error">No records found</div>
    <div v-else-if="error">{{ error }}</div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      flowMeasures: [],
      loading: true,
      error: null,
      sortKey: '',
      sortOrder: 1, // 1 for ascending, -1 for descending
      identifierFilter: '', // New filter for identifier
      showExpiredWithdrawn: true, // Toggle for expired/withdrawn measures
      showNotified: true, // Toggle for notified measures
      time: '' // New property to hold the timestamp of API data
    };
  },
  computed: {
    filteredFlowMeasures() {
      return this.flowMeasures
        .filter(measure => measure.ident.toLowerCase().includes(this.identifierFilter.toLowerCase()))
        .filter(measure => this.showExpiredWithdrawn || (!this.isExpired(measure.endtime) && !this.isWithdrawn(measure.withdrawn_at)))
        .filter(measure => this.showNotified || !this.isNotified(measure.starttime));
    },
    sortedMeasures() {
      if (!this.sortKey) return this.filteredFlowMeasures;
      return [...this.filteredFlowMeasures].sort((a, b) => {
        let fieldA = this.resolveNestedValue(a, this.sortKey);
        let fieldB = this.resolveNestedValue(b, this.sortKey);
        if (this.sortKey === 'starttime' || this.sortKey === 'endtime') {
          fieldA = new Date(fieldA).getTime();
          fieldB = new Date(fieldB).getTime();
        }
        if (fieldA < fieldB) return -1 * this.sortOrder;
        if (fieldA > fieldB) return 1 * this.sortOrder;
        return 0;
      });
    }
  },
  created() {
    this.fetchFlowMeasures();
    setInterval(this.fetchFlowMeasures, 300000); // Fetch data every minute
    setInterval(this.checkStates, 1000); // Check state every second
  },
  methods: {
    formatTime(time) {
      return time.replace("T", "  ").replace(/:\d{2}\.\d{3}Z$/, "Z").replace(":00Z", ""); // Remove decimal seconds and format
    },
    isActive(measure) {
      const now = new Date().toISOString(); // Current UTC time in ISO format
      const startTime = measure.starttime;
      const endTime = measure.withdrawn_at || measure.endtime; // Use withdrawn_at if present
      return now >= startTime && now <= endTime;
    },
    isExpired(endtime) {
      const now = new Date().toISOString(); // Current UTC time in ISO format
      return now > endtime;
    },
    isNotified(starttime) {
      const now = new Date();
      const startDate = new Date(starttime);
      const timeDiff = startDate - now;
      return timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    },
    isWithdrawn(withdrawn_at) {
      return withdrawn_at ? true : false; // True if withdrawn_at exists
    },
    checkStates() {
      this.flowMeasures.forEach(measure => {
        measure.isActive = this.isActive(measure);
        measure.isExpired = this.isExpired(measure.endtime);
        measure.isNotified = this.isNotified(measure.starttime);
        measure.isWithdrawn = this.isWithdrawn(measure.withdrawn_at);
      });
    },
    toggleExpiredWithdrawn() {
      this.showExpiredWithdrawn = !this.showExpiredWithdrawn;
    },
    toggleNotified() {
      this.showNotified = !this.showNotified;
    },
    resolveNestedValue(obj, path) {
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    },
    async fetchFlowMeasures() {
      try {
        const response = await axios.get('https://ecfmp.vatsim.net/api/v1/flow-measure');
        if (response.data && Array.isArray(response.data)) {
          this.flowMeasures = response.data;
          this.time = new Date().toISOString(); // Update the timestamp to current time
          this.checkStates(); // Run initial state check after fetching data
        } else {
          this.error = 'No data received from the server.';
        }
      } catch (err) {
        console.error('Error fetching data:', err);  // Log any error that occurs during the request
        this.error = 'Failed to load flow measures. Please try again later.';
      } finally {
        this.loading = false;
      }
    },
    sortBy(key) {
      if (key === 'measure' || key === 'filters') return;
      if (this.sortKey === key) {
        this.sortOrder *= -1; // Reverse the sort order
      } else {
        this.sortOrder = 1; // Reset to ascending
      }
      this.sortKey = key;
    },
    getType(measure) {
      const typeMapping = {
        'minimum_departure_interval': 'MDI',
        'average_departure_interval': 'ADI',
        'per_hour': 'Rate',
        'miles_in_trail': 'MIT',
        'max_ias': 'Max IAS',
        'max_mach': 'Max Mach',
        'ias_reduction': 'IAS Reduction',
        'mach_reduction': 'Mach Reduction',
        'prohibit': 'Prohibit',
        'ground_stop': 'GROUND STOP',
        'mandatory_route': 'Mandatory Route'
      };
      return measure && measure.type ? (typeMapping[measure.type] || 'NIL') : 'NIL';
    },
    getTypeTooltip(measure) {
      const tooltipMapping = {
        'minimum_departure_interval': 'Minimum departure interval',
        'average_departure_interval': 'Average departure interval applied over 3 aircraft',
        'per_hour': 'Number of flights per hour permitted',
        'miles_in_trail': 'Distance between aircraft in trail',
        'max_ias': 'Maximum speed',
        'max_mach': 'Maximum speed',
        'ias_reduction': 'Reduce indicated airspeed by certain value',
        'mach_reduction': 'Reduced mach by certain value',
        'prohibit': 'Prohibit a flight according to filters',
        'ground_stop': 'NO DEPARTURES ARE PERMITTED',
        'mandatory_route': 'Mandate routing via a single waypoint/airway only'
      };
      return measure && measure.type ? (tooltipMapping[measure.type] || '') : '';
    },
    getFormattedValue(measure) {
      if (!measure || !measure.value) {
        return 'NIL';
      }
      const { type, value } = measure;
      switch (type) {
        case 'minimum_departure_interval':
        case 'average_departure_interval':
          const minutes = Math.floor(value / 60);
          const seconds = value % 60;
          return seconds === 0 
          ? `${minutes} min` 
          : `${minutes} min ${seconds} sec`;
        case 'per_hour':
          return `${value} / h`;
        case 'miles_in_trail':
          return `${value} nm of aircraft in trail`;
        case 'max_ias':
          return `${value} kt`;
        case 'max_mach':
          return `0.${value}`;
        case 'ias_reduction':
          return `${value} kt`;
        case 'mach_reduction':
          return `0.0${value}`;
        case 'prohibit':
          return 'Prohibited';
        case 'ground_stop':
          return ' ';
        case 'mandatory_route':
          return measure.value.join(' OR ');
        default:
          return 'NIL';
      }
    },
    formatFilters(filters) {
      if (!Array.isArray(filters) || filters.length === 0) {
        return 'None';
      }
      return filters.map(filter => `${filter.type}: ${filter.value.join(', ')}`).join(' | ');
    }
  }
};
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  cursor: pointer;
  background-color: #9E9E9E; /* Darker gray background for the header */
  color: #ffffff; /* White text color for the header */
  padding: 6px;
  text-align: left;
  font-weight: bold; /* Makes the header text bold */
}
td {
  padding: 6px;
}
tbody tr:nth-child(even) {
  background-color: #f9f9f9; /* Light gray background for even rows */
}
</style>
