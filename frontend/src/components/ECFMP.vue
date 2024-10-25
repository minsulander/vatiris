<template>
  <div>
    <!-- Filter Input and Toggle Buttons -->
    <div style="background-color: #9E9E9E; padding: 2px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center;">
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

        <!-- Toggle Reason -->
        <button 
          @click="toggleReason" 
          :style="{ 
            marginLeft: '4px', 
            color: showReason ? 'white' : 'gray', 
            backgroundColor: showReason ? 'gray' : 'transparent', 
            border: `1px solid gray`, 
            padding: '4px 8px', 
            borderRadius: '4px'
          }"
        >
          Reason
        </button>
      </div>

      <div style="display: flex; align-items: center;">
        <!-- Create new Flow measure button -->
        <a 
          href="https://ecfmp.vatsim.net/dashboard/flow-measures/create" 
          target="_blank" 
          style="
            margin-right: 12px;
            text-decoration: none;
            color: white;
            background-color: #4CAF50;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 14px;
            display: flex;
            align-items: center;
          "
        >
          New
          <span class="mdi mdi-open-in-new" style="margin-left: 4px;"></span>
        </a>

        <!-- Timestamp of API data -->
        <div style="color: #616161;">
          {{ formatApiTime(time) }}
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <table v-if="!error">
      <thead>
        <tr>
          <th style="width: 100px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="cursor: pointer; font-weight: bold;" @click="sortBy('ident')">ID</span>
              <input 
                type="text" 
                v-model="identifierFilter" 
                placeholder="Filter" 
                style="width: 50%; padding: 2px; font-weight: normal;"
              />
            </div>
          </th>
          <th style="width: 140px;">
            <span style="cursor: pointer; font-weight: bold;" @click="sortBy('starttime')">Start Time</span>
          </th>
          <th>
            <span style="cursor: pointer; font-weight: bold;" @click="sortBy('endtime')">End Time</span>
          </th>
          <th>
            <span style="cursor: pointer; font-weight: bold;" @click="sortBy('measure.type')">Type</span>
          </th>
          <th>
            <span style="font-weight: bold;">Value</span>
          </th>
          <th>
            <div style="display: flex; align-items: center;">
              <span style="font-weight: bold;">Filters</span>
              <input 
                type="text" 
                v-model="filtersFilter" 
                placeholder="Filter" 
                style="width: 50%; padding: 2px; font-weight: normal; margin-left: 10px;"
              />
            </div>
          </th>
          <th v-if="showReason">
            <div style="display: flex; align-items: center;">
              <span style="font-weight: bold;">Reason</span>
              <input 
                type="text" 
                v-model="reasonFilter" 
                placeholder="Filter" 
                style="width: 50%; padding: 2px; font-weight: normal; margin-left: 10px;"
              />
            </div>
          </th>
        </tr>
      </thead>
      <tbody v-if="sortedMeasures.length > 0">
        <tr 
          v-for="measure in sortedMeasures" 
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
            :title="measure.withdrawn_at ? 'Withdrawn' :
                    isActive(measure) ? 'Active' : 
                    isExpired(measure.endtime) ? 'Expired' : 
                    isNotified(measure.starttime) ? 'Notified' : 
                    ''"
          >
            <a :href="`https://ecfmp.vatsim.net/dashboard/flow-measures/${measure.id}`" target="_blank" style="color: inherit; text-decoration: none;">{{ measure.ident }}</a>
          </td>
          <td :title="getTimeLeftTooltip(measure.starttime, measure.withdrawn_at)">{{ formatTime(measure.starttime) }}</td>
          <td :title="getTimeLeftTooltip(measure.endtime, measure.withdrawn_at)">
            <span :style="{ textDecoration: measure.withdrawn_at ? 'line-through' : 'none' }">
              {{ formatEndTime(measure.starttime, measure.endtime) }}
            </span>
            <span v-if="measure.withdrawn_at" style="margin-left: 5px;">
              {{ formatWithdrawnTime(measure.withdrawn_at) }}
            </span>
          </td>
          <td :title="getTypeTooltip(measure.measure)">{{ getType(measure.measure) }}</td>
          <td>{{ getFormattedValue(measure.measure) }}</td>
          <td>{{ formatFilters(measure.filters) }}</td>
          <td v-if="showReason">{{ measure.reason }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="loading">Loading...</div>
    <div v-else-if="sortedMeasures.length === 0 && !error" style="padding: 10px;">No records found</div>
    <div v-else-if="error">{{ error }}</div>
  </div>
</template>
<script>
import axios from 'axios';
import useEventBus from "@/eventbus";

export default {
  data() {
    return {
      flowMeasures: [],
      loading: true,
      error: null,
      sortKey: '',
      sortOrder: 1, // 1 for ascending, -1 for descending
      identifierFilter: '', // New filter for identifier
      showExpiredWithdrawn: false, // Toggle for expired/withdrawn measures
      showNotified: true, // Toggle for notified measures
      showReason: false, // Toggle for reason column
      time: '', // New property to hold the timestamp of API data
      filtersFilter: '',
      reasonFilter: ''
    };
  },
  computed: {
    filteredFlowMeasures() {
      return this.flowMeasures
        .filter(measure => measure.ident.toLowerCase().includes(this.identifierFilter.toLowerCase()))
        .filter(measure => this.showExpiredWithdrawn || (!this.isExpired(measure.endtime) && !this.isWithdrawn(measure.withdrawn_at)))
        .filter(measure => this.showNotified || !this.isNotified(measure.starttime))
        .filter(measure => {
          const formattedFilters = this.formatFilters(measure.filters).toLowerCase();
          return formattedFilters.includes(this.filtersFilter.toLowerCase());
        })
        .filter(measure => {
          if (!this.showReason) return true;
          return measure.reason.toLowerCase().includes(this.reasonFilter.toLowerCase());
        });
    },
    sortedMeasures() {
      return [...this.filteredFlowMeasures].sort((a, b) => {
        let fieldA = this.resolveNestedValue(a, this.sortKey);
        let fieldB = this.resolveNestedValue(b, this.sortKey);
        
        if (this.sortKey === 'starttime' || this.sortKey === 'endtime') {
          fieldA = new Date(fieldA).getTime();
          fieldB = new Date(fieldB).getTime();
        } else if (this.sortKey === 'measure.type') {
          fieldA = this.getType(a.measure);
          fieldB = this.getType(b.measure);
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
    const bus = useEventBus();
    bus.on("refresh", () => {
      this.flowMeasures = [];
      this.fetchFlowMeasures();
    });
  },
  methods: {
    formatTime(time) {
      return time.replace("T", "  ").replace(/:\d{2}\.\d{3}Z$/, "Z").replace(/:\d{2}Z$/, "");
    },
    formatApiTime(time) {
      return time.replace("T", " ").replace(/:\d{2}\.\d{3}Z$/, "Z");
    },
    formatEndTime(starttime, endtime) {
      const startDate = new Date(starttime);
      const endDate = new Date(endtime);
      
      if (startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
          startDate.getUTCMonth() === endDate.getUTCMonth() &&
          startDate.getUTCDate() === endDate.getUTCDate()) {
        // If same date, return only time
        return endtime.split("T")[1].substring(0, 5);
      } else {
        // If different date, return date and time
        return endtime.replace("T", " ").substring(0, 16);
      }
    },
    formatWithdrawnTime(withdrawn_at) {
      return withdrawn_at.split("T")[1].substring(0, 5);
    },
    getTimeLeftTooltip(timestamp, withdrawn_at) {
      if (withdrawn_at) {
        return 'Withdrawn';
      }

      const now = new Date();
      const target = new Date(timestamp);
      const timeDiff = target - now;
      
      if (timeDiff <= 0) {
        return 'Expired';
      }
      
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${hours}h ${minutes}m left`;
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
      return withdrawn_at ? true : false;
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
      try {
        this.showExpiredWithdrawn = !this.showExpiredWithdrawn;
        // Force a re-render of the component
        this.$forceUpdate();
      } catch (error) {
        console.error('Error in toggleExpiredWithdrawn:', error);
      }
    },
    toggleNotified() {
      this.showNotified = !this.showNotified;
    },
    toggleReason() {
      this.showReason = !this.showReason;
    },
    resolveNestedValue(obj, path) {
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    },
    async fetchFlowMeasures() {
      try {
        const response = await axios.get('https://ecfmp.vatsim.net/api/v1/flow-measure?deleted=1');
        if (response.data && Array.isArray(response.data)) {
          this.flowMeasures = response.data;
          this.time = new Date().toISOString(); // Update the timestamp to current time
          this.checkStates(); // Run initial state check after fetching data
        } else {
          this.error = 'No data received from the server.';
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        this.error = 'Failed to load flow measures. Please try again later.';
      } finally {
        this.loading = false;
      }
    },
    sortBy(key) {
      if (this.sortKey === key) {
        this.sortOrder *= -1; // Reverse the sort order
      } else {
        this.sortKey = key;
        this.sortOrder = 1; // Reset to ascending
      }
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
        'average_departure_interval': 'Average departure interval (applied over 3 aircraft)',
        'per_hour': 'Number of flights permitted per hour',
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
          return `${value} nm`;
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
      return filters.map(filter => {
        const { type, value } = filter;
        switch (type) {
          case 'ADEP':
          case 'ADES':
            return `${type}: ${Array.isArray(value) ? value.join(', ') : value}`;
          case 'level_above':
            return `FL${value}+`;
          case 'level_below':
            return `FL${value}-`;
          case 'level':
            return `FL=${Array.isArray(value) ? value.join('/') : value}`;
          case 'waypoint':
            return `Via: ${Array.isArray(value) ? value.join(' OR ') : value}`;
          case 'member_event':
            return 'Event Member';
          case 'member_not_event':
            return 'Not Event Member';
          default:
            return `${type}: ${JSON.stringify(value)}`;
        }
      }).join(' | ');
    },
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
  max-width: 300px; /* Adjust this value as needed */
  word-wrap: break-word;
  overflow-wrap: break-word;
}
td {
  padding: 6px;
  max-width: 300px; /* Adjust this value as needed */
  word-wrap: break-word;
  overflow-wrap: break-word;
}
tbody tr:nth-child(even) {
  background-color: #f9f9f9; /* Light gray background for even rows */
}
</style>
