<template>
  <div class="alias-container">
    <!-- Filter buttons and search input -->
    <div class="toolbar">
      <div class="search-container">
        <input
          v-model="search"
          type="text"
          placeholder="Search"
          class="search-input"
        />
        <button @click="clearSearch" class="clear-button">
          <span class="mdi mdi-close"></span>
        </button>
      </div>
      <div class="filter-buttons">
        <button 
          v-for="(group, groupName) in filteredGroups" 
          :key="groupName"
          @click="toggleGroup(groupName)"
          :style="getButtonStyle(groupName)"
        >
          {{ groupName }}
        </button>
      </div>
    </div>

    <!-- Alias table -->
    <div class="table-container">
      <table v-if="!error">
        <thead>
          <tr>
            <th @click="sortBy('trigger')">Trigger</th>
            <th @click="sortBy('expansion')">Expansion</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="alias in sortedAliases" :key="alias.trigger">
            <td>{{ alias.trigger }}</td>
            <td>{{ alias.expansion }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="loading">Loading...</div>
      <div v-else-if="error">{{ error }}</div>
      <div v-else-if="sortedAliases.length === 0" style="padding: 10px;">No aliases found</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import aliasData from '@/data/alias.txt?raw';

const aliasGroups = ref({});
const search = ref('');
const visibleGroups = ref({});
const loading = ref(true);
const error = ref(null);
const sortKey = ref('trigger');
const sortOrder = ref(1);

const parseAliasGroups = (data: string) => {
  const lines = data.split('\n');
  const groups: Record<string, Record<string, string>> = {};
  let currentGroup = '';

  lines.forEach(line => {
    line = line.trim();
    if (line.startsWith(';***')) {
      const match = line.match(/;\*\*\*\s*([^*]+)\s*\*\*\*/);
      if (match) {
        currentGroup = match[1].trim();
        groups[currentGroup] = {};
      }
    } else if (line && !line.startsWith(';') && currentGroup) {
      const [trigger, ...expansionParts] = line.split(' ');
      const expansion = expansionParts.join(' ').trim();
      if (trigger && expansion) {
        groups[currentGroup][trigger] = expansion;
      }
    }
  });

  return groups;
};
const loadAliases = () => {
  try {
    aliasGroups.value = parseAliasGroups(aliasData);
    // Initialize visibility of groups
    Object.keys(aliasGroups.value).forEach(groupName => {
      if (groupName === 'Sweden') {
        visibleGroups.value[groupName] = true;
      } else if (groupName === 'Auto' || groupName === 'FSS') {
        visibleGroups.value[groupName] = false;
      } else {
        visibleGroups.value[groupName] = true; // Set other groups to visible by default
      }
    });
    loading.value = false;
  } catch (error) {
    console.error('Error loading aliases:', error);
    error.value = 'Failed to load aliases. Please try again later.';
    loading.value = false;
  }
};

onMounted(loadAliases);

const filteredGroups = computed(() => {
  return Object.fromEntries(
    Object.entries(aliasGroups.value).filter(([groupName]) => groupName !== 'Sweden')
  );
});

const filteredAliases = computed(() => {
  const aliases = [];
  Object.entries(aliasGroups.value).forEach(([groupName, group]) => {
    if (visibleGroups.value[groupName] || groupName === 'Sweden') {
      Object.entries(group).forEach(([trigger, expansion]) => {
        if (trigger.toLowerCase().includes(search.value.toLowerCase()) ||
            expansion.toLowerCase().includes(search.value.toLowerCase())) {
          aliases.push({ trigger, expansion });
        }
      });
    }
  });
  return aliases;
});

const sortedAliases = computed(() => {
  return [...filteredAliases.value].sort((a, b) => {
    const aValue = a[sortKey.value].toLowerCase();
    const bValue = b[sortKey.value].toLowerCase();
    return aValue.localeCompare(bValue) * sortOrder.value;
  });
});

const toggleGroup = (groupName: string) => {
  if (groupName !== 'Sweden') {
    visibleGroups.value[groupName] = !visibleGroups.value[groupName];
  }
};

const getButtonStyle = (groupName: string) => {
  const isVisible = visibleGroups.value[groupName];
  return {
    marginLeft: '4px',
    color: isVisible ? 'white' : '#616161',
    backgroundColor: isVisible ? '#616161' : 'transparent',
    border: '1px solid #616161',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
  };
};

const sortBy = (key: string) => {
  if (sortKey.value === key) {
    sortOrder.value *= -1;
  } else {
    sortKey.value = key;
    sortOrder.value = 1;
  }
};

const clearSearch = () => {
  search.value = '';
};
</script>

<style scoped>
.alias-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  padding: 4px;
  background-color: #9E9E9E;
  display: flex;
  align-items: center;
  gap: 6px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.search-container {
  margin-right: 10px;
  display: flex;
  align-items: center;
  position: relative;
}

.search-input {
  padding: 8px;
  padding-right: 30px;
  border: 1px solid #616161;
  color: #333;
  border-radius: 4px;
  width: 300px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #424242;
  box-shadow: 0 0 0 1px #424242;
}

.clear-button {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-button .mdi {
  font-size: 18px;
  color: #616161;
}

.clear-button:hover .mdi {
  color: #424242;
}

.filter-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
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
  max-width: 300px;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

tbody tr:nth-child(even) {
  background-color: #f9f9f9;
}
</style>
