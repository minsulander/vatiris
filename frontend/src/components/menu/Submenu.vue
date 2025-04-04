<template>
    <v-menu activator="parent" :location="sub ? 'end' : 'bottom'" style="user-select: none">
        <v-list density="compact">
            <v-list-item v-if="Object.keys(items).length > 12" style="margin-top: -10px">
                <v-text-field
                    ref="filterField"
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
                :key="label + action"
                @click="click($event, action)"
                @contextmenu.prevent="bus.emit('unselect', action)"
            >
                <v-list-item-title
                    >{{ label }}
                    <v-icon
                        v-if="typeof action == 'object'"
                        color="grey-darken-2"
                        class="ml-2 float-right"
                        style="margin-top: 2px; margin-right: -3px"
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
                    <submenu :items="action" :sub="true" />
                </template>
                <template v-else-if="typeof action == 'object'">
                    <submenu v-model="open" :items="action" :sub="true" />
                </template>
            </v-list-item>
        </v-list>
    </v-menu>
</template>

<script setup lang="ts">
import useEventBus from "@/eventbus"
import { useWindowsStore } from "@/stores/windows"
import { computed, ref, watch } from "vue"

const props = defineProps<{
    items: { [key: string]: string }
    sub?: boolean
}>()
const windows = useWindowsStore()
const bus = useEventBus()

const filterField = ref()
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

function filterEnter(event: KeyboardEvent) {
    const keys = Object.keys(filteredItems.value)
    if (keys.length == 1) {
        let id = props.items[keys[0]]
        if (typeof id == "object") {
            open.value = true
            event.stopPropagation()
        } else {
            if (event.shiftKey) event.stopPropagation()
            if (event.ctrlKey || event.altKey || event.metaKey) id = "ctrl+" + id
            bus.emit("select", id)
            filter.value = ""
        }
    } else {
        event.stopPropagation()
    }
}

function click(event: KeyboardEvent | MouseEvent, id: string) {
    if (event.shiftKey) event.stopPropagation()
    if (event.ctrlKey || event.altKey || event.metaKey) id = "ctrl+" + id
    bus.emit("select", id)
}

watch(filterField, () => {
    // workaround for autofocus working when it feels like it...
    setTimeout(() => {
        if (filterField.value) filterField.value.focus()
    }, 10)
    setTimeout(() => {
        if (filterField.value) filterField.value.focus()
        else filter.value = ""
    }, 100)
})
</script>
