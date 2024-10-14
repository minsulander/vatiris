<template>
  <div class="coordinations-container">
    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else>
      <v-card variant="tonal" rounded="0" v-for="(group, index) in filteredCoordinationGroups" :key="index" class="mb-2">
        <v-card-title>
          <v-btn variant="text" rounded="0"
            @click="toggleExpand(index)"
            :icon="expanded[index] ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            :ripple="false"
          ></v-btn>
          {{ group.group }}
        </v-card-title>
        <!-- Remove v-expand-transition and show content based on expanded state -->
        <div v-show="expanded[index]">
          <v-card-text>
            <ul>
              <li v-for="(item, itemIndex) in group.items" :key="itemIndex">
                {{ item }}
              </li>
            </ul>
          </v-card-text>
        </div>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import coordinationsData from '@/data/coordination/coordinations.json';
import useEventBus from "@/eventbus";

const props = defineProps<{
  id: string;
}>();

const coordinationGroups = ref<any[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const expanded = ref<boolean[]>([]);

const filteredCoordinationGroups = computed(() => {
  const selectedCoordination = coordinationGroups.value.find(coord => coord.id === props.id);
  return selectedCoordination ? selectedCoordination.groups : [];
});

const toggleExpand = (index: number) => {
  expanded.value[index] = !expanded.value[index];
};

const reloadCoordinations = () => {
  try {
    // Re-import the coordinations data
    import('@/data/coordination/coordinations.json').then((module) => {
      coordinationGroups.value = module.default;
      expanded.value = new Array(coordinationGroups.value.length).fill(false);
      loading.value = false;
      error.value = null;
    });
  } catch (err) {
    console.error('Error reloading coordinations:', err);
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
    loading.value = false;
  }
};

onMounted(() => {
  try {
    coordinationGroups.value = coordinationsData;
    expanded.value = new Array(coordinationGroups.value.length).fill(false);
    loading.value = false;
  } catch (err) {
    console.error('Error loading coordinations:', err);
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
    loading.value = false;
  }

  // Set up event bus listener
  const bus = useEventBus();
  bus.on("refresh", () => {
    reloadCoordinations();
  });
});
</script>

<style scoped>
.coordinations-container {
  margin-top: 8px;
}

ul {
  padding-left: 20px;
}
.mb-4 {
  margin-bottom: 16px;
}
</style>
