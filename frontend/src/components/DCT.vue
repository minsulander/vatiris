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
        <div class="card-title">{{ group.group }}</div>
        <v-card-text>
          <div class="item-container">
            <v-chip
              v-for="(item, itemIndex) in group.items"
              rounded="0"
              :key="itemIndex"
              class="item-chip"
              color="#08FD2F"
              variant="flat"
            >
              {{ item }}
            </v-chip>
          </div>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import directsData from '@/data/dct/directs.json';
import useEventBus from "@/eventbus";

const props = defineProps<{
  id: string;
}>();

const directGroups = ref<any[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const expanded = ref<boolean[]>([]);

const filteredDirectGroups = computed(() => {
  const lowercaseId = props.id.toLowerCase();
  const selectedDirect = directGroups.value.find(direct => direct.id.toLowerCase() === lowercaseId);
  return selectedDirect ? selectedDirect.groups : [];
});

const toggleExpand = (index: number) => {
  expanded.value[index] = !expanded.value[index];
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
});
</script>

<style scoped>
.card-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px;
}

.card-title {
  position: absolute;
  font-size: 0.9rem;
  z-index: 1;
  background-color: #dddddd;
  top: -10px;
  left: 8px;
  padding: 0 4px;
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
  font-size: 0.7rem;
  padding: 0 2px;
  height: 20px;
  min-width: 20px;
}

.v-card-text {
  padding: 6px;
}
</style>
