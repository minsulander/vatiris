<template>
    <v-menu activator="parent" :location="sub ? 'end' : 'bottom'">
        <v-list density="compact">
            <v-list-item v-if="Object.keys(items).length > 10" style="margin-top: -10px">
                <v-text-field
                    variant="underlined"
                    density="compact"
                    hide-details
                    autofocus
                    v-model="filter"
                    @keydown.esc="filter = ''"
                    @keydown.enter="filterEnter"
                    @click.stop=""
                ></v-text-field>
            </v-list-item>
            <v-list-item
                v-for="(action, label) in filteredItems"
                :class="action in windows.winbox ? '' : 'text-grey'"
                :key="action"
                @click="emit('select', action)"
            >
                <v-list-item-title
                    >{{ label }}
                    <v-icon
                        v-if="
                            typeof action == 'object'
                        "
                        color="grey-darken-2"
                        class="ml-2 float-right"
                        style="margin-right: -3px"
                        size="small"
                        >mdi-chevron-right</v-icon
                    >
                    <v-icon
                        v-else-if="
                            typeof action == 'string' &&
                            action.startsWith &&
                            action.startsWith('https://')
                        "
                        color="grey-darken-2"
                        class="ml-2 float-right"
                        style="margin-top: 3px"
                        size="x-small"
                        >mdi-open-in-new</v-icon
                    >
                </v-list-item-title>
                <template v-if="typeof action == 'object' && Object.keys(filteredItems).length > 1">
                    <submenu :items="action" :sub="true" @select="select" />
                </template>
                <template v-else-if="typeof action == 'object'">
                    <submenu v-model="open" :items="action" :sub="true" @select="select" />
                </template>
            </v-list-item>
        </v-list>
    </v-menu>
</template>

<script setup lang="ts">
import { useWindowsStore } from "@/stores/windows"
import { computed, ref } from "vue"

const props = defineProps<{
    items: { [key: string]: string }
    sub?: boolean
}>()
const emit = defineEmits(["select"])
const windows = useWindowsStore()

const filter = ref("")
const open = ref(false)

const filteredItems = computed(() => {
    if (!filter.value) return props.items
    const lower = filter.value.toLowerCase()
    const items = {} as any
    for (const key in props.items) {
        if (key.toLowerCase().includes(lower)) items[key] = props.items[key]
    }
    return items
})

function filterEnter(e: KeyboardEvent) {
    const keys = Object.keys(filteredItems.value)
    if (keys.length == 1) {
        if (typeof props.items[keys[0]] == "object") {
            open.value = true
            e.stopPropagation()
        } else {
            select(props.items[keys[0]])
            filter.value = ""
        }
    } else {
        e.stopPropagation()
    }
}

function select(id: string) {
    emit("select", id)
}
</script>
