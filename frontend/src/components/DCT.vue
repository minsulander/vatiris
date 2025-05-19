<template>
  <div>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else class="card-grid">
      <v-card
        v-for="(group, index) in filteredDirectGroups"
        :key="index"
        class="direct-card"
        variant="outlined"
      >
        <div class="card-title">
          <div class="menu-container">
            <v-icon 
              icon="mdi-application-edit-outline" 
              size="small" 
              class="mr-1 mt-n1 cursor-pointer"
              @click.stop="openMenu(index, $event)"
            ></v-icon>
          </div>
          {{ group.group }}
        </div>
        <v-card-text>
          <div class="item-container">
            <v-chip
              v-for="(item, itemIndex) in group.items"
              rounded="0"
              :key="itemIndex"
              class="item-chip"
              :color="typeof item === 'string' ? '#ffffff' : item.color"
              variant="flat"
            >
              {{ typeof item === 'string' ? item : item.text }}
            </v-chip>
          </div>
        </v-card-text>
      </v-card>
    </div>
    <teleport to="body">
      <div v-if="activeMenu !== null" :style="menuStyle" class="custom-menu" @click.stop>
        <input 
          v-model="newChipContent[activeMenu]" 
          placeholder="Enter chip text"
          class="menu-input"
        />
        <div class="color-options">
          <label>
            <input 
              type="radio" 
              :value="'#08FD2F'" 
              v-model="selectedColor[activeMenu]"
            /> Green
          </label>
          <label>
            <input 
              type="radio" 
              :value="'#d3002e'" 
              v-model="selectedColor[activeMenu]"
            /> Red
          </label>
        </div>
        <button 
          class="add-button"
          @click="addChip(activeMenu)"
          :disabled="!newChipContent[activeMenu]"
        >
          Add Chip
        </button>
      </div>
    </teleport>
  </div>
</template>

//Colour for future whiteboards #08FD2F

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import directsData from '@/data/dct/directs.json';
import useEventBus from "@/eventbus";

const props = defineProps<{
  id: string;
}>();

const directGroups = ref<any[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const expanded = ref<boolean[]>([]);
const newChipContent = ref<{ [key: number]: string }>({});
const selectedColor = ref<{ [key: number]: string }>({});
const activeMenu = ref<number | null>(null);
const menuStyle = ref('');

const filteredDirectGroups = computed(() => {
  const lowercaseId = props.id.toLowerCase();
  const selectedDirect = directGroups.value.find(direct => direct.id.toLowerCase() === lowercaseId);
  if (!selectedDirect) return [];
  
  // Transform the groups to support both old and new chip formats
  return selectedDirect.groups.map((group: any) => ({
    ...group,
    items: group.items.map((item: any) => 
      typeof item === 'string' ? { text: item, color: '#ffffff' } : item
    )
  }));
});

const toggleExpand = (index: number) => {
  expanded.value[index] = !expanded.value[index];
};

const openMenu = (index: number, event: MouseEvent) => {
  activeMenu.value = index;
  nextTick(() => {
    // Get the bounding rect of the icon
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    // Position the menu below the icon
    menuStyle.value = `position: fixed; top: ${rect.bottom + 4}px; left: ${rect.left}px; z-index: 99999;`;
  });
};

const toggleMenu = (index: number) => {
  activeMenu.value = activeMenu.value === index ? null : index;
};

const addChip = (groupIndex: number) => {
  const content = newChipContent.value[groupIndex];
  const color = selectedColor.value[groupIndex];
  
  if (!content) return;

  const group = filteredDirectGroups.value[groupIndex];
  
  // If adding a red chip, check for existing white chip with same content
  if (color === '#d3002e') {
    const existingIndex = group.items.findIndex(
      (item: any) => (typeof item === 'string' ? item : item.text) === content && 
                     (typeof item === 'string' ? '#ffffff' : item.color) === '#ffffff'
    );
    if (existingIndex !== -1) {
      group.items[existingIndex] = { text: content, color };
      newChipContent.value[groupIndex] = '';
      return;
    }
  }

  // Add new chip
  group.items.push({ text: content, color });
  newChipContent.value[groupIndex] = '';
  
  // Force reactivity update
  directGroups.value = [...directGroups.value];
};

const reloadDirects = () => {
  try {
    // Re-import the directs data
    import('@/data/dct/directs.json').then((module) => {
      directGroups.value = module.default;
      expanded.value = new Array(directGroups.value.length).fill(false);
      loading.value = false;
      error.value = null;
    });
  } catch (err) {
    console.error('Error reloading directs:', err);
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
    loading.value = false;
  }
};

onMounted(() => {
  try {
    directGroups.value = directsData;
    expanded.value = new Array(directGroups.value.length).fill(false);
    loading.value = false;
  } catch (err) {
    console.error('Error loading directs:', err);
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
    loading.value = false;
  }

  // Set up event bus listener
  const bus = useEventBus();
  bus.on("refresh", () => {
    reloadDirects();
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.custom-menu')) {
      activeMenu.value = null;
    }
  });
});
</script>

<style scoped>
.card-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 13px 10px 10px 10px;
  overflow: visible;
}

.card-title {
  position: absolute;
  font-size: 0.9rem;
  z-index: 1;
  background-color: #dddddd;
  top: -10px;
  left: 4px;
  padding: 0 4px;
  display: flex;
  align-items: center;
}

.direct-card {
  padding-top: 4px;
  flex: 1 1 175px;
  margin: 0;
  position: relative;
  overflow: visible !important;
}

.item-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.item-chip {
  z-index: 2;
  font-size: 0.9rem;
  padding: 0 2px;
  height: 20px;
  min-width: 20px;
}

.v-card-text {
  padding: 6px;
}

.menu-container {
  position: relative;
  display: inline-block;
  z-index: 1000;
}

.custom-menu {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  min-width: 200px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-top: 4px;
  z-index: 99999;
}

.menu-input {
  width: 100%;
  padding: 4px;
  margin-bottom: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.color-options {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.color-options label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.add-button {
  width: 100%;
  padding: 4px 8px;
  background: #1976d2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
