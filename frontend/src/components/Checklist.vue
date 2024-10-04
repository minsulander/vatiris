<template>
    <div style="height: 30px; background: #666">
        <div class="float-right pa-1 text-body-2">
        <span class="text-white" v-if="isAllChecked">ALL CHECKED</span>
        <span class="text-grey-lighten-1" v-else>{{ checkedRows.length }} / {{ items.length }}</span>
    </div>
        <v-btn
            variant="text"
            rounded="0"
            size="small"
            :color="isAllChecked ? 'white' : 'grey-lighten-1'"
            @click="reset"
            >RESET</v-btn
        >
    </div>
    <div style="height: calc(100% - 30px); overflow-y: auto">
        <table cellspacing="0" style="width: 100%">
            <tr
                v-for="(item, i) in items"
                :key="i"
                :class="
                    'item-' + (i % 2 == 0 ? 'even' : 'odd') + (isRowChecked(i) ? ' checked' : '')
                "
                style="cursor: pointer"
                @click="clickRow(i)"
            >
                <td class="pa-1 pt-2">
                    <v-icon color="grey" v-if="isRowChecked(i)">mdi-check</v-icon>
                    <v-icon color="grey" v-else>mdi-square-outline</v-icon>
                </td>
                <td class="pa-1" style="white-space: pre-wrap" v-html="item.split('...')[0]"></td>
                <td class="pa-1 text-right">
                    {{ item.split("...")[1] }}
                </td>
            </tr>
        </table>
    </div>
</template>

<style>
tr:hover {
    background: #ccc;
}
tr:not(:hover).item-even {
    background: #fff;
}
tr:not(:hover).item-odd {
    background: #eee;
}
tr:hover.checked td {
    opacity: 0.7;
}
tr:not(:hover).checked td {
    opacity: 0.5;
}
</style>

<script setup lang="ts">
import { computed, reactive } from "vue"

const props = defineProps<{
    id: String
    items: String[]
}>()
const checkedRows = reactive([] as number[])
const isRowChecked = (index: number) => checkedRows.includes(index)
const isAllChecked = computed(() => checkedRows.length == props.items.length)

function clickRow(index: number) {
    const checkedIndex = checkedRows.indexOf(index)
    if (checkedIndex >= 0) {
        checkedRows.splice(checkedIndex, 1)
    } else {
        checkedRows.push(index)
    }
    sessionStorage[`checklist_${props.id}`] = JSON.stringify(checkedRows)
}

function reset() {
    checkedRows.splice(0)
}

// init

if (`checklist_${props.id}` in sessionStorage) {
    for (const i of JSON.parse(sessionStorage[`checklist_${props.id}`])) checkedRows.push(i)
}
</script>
