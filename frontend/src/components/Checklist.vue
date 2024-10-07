<template>
    <div style="height: 30px; background: #666">
        <div class="float-right pa-1 text-body-2">
            <span class="text-white" v-if="isAllChecked">ALL CHECKED</span>
            <span class="text-grey-lighten-1" v-else
                >{{ checkedRows.length }} / {{ checklist.items.length }}</span
            >
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
        <div
            v-if="checklist.preDescription"
            class="pa-2 text-caption text-grey-darken-2"
            style="white-space: pre-wrap"
            v-html="checklist.preDescription"
        ></div>
        <table cellspacing="0" style="width: 100%">
            <template v-for="(item, i) in checklist.items" :key="i">
                <tr v-if="checklist.sections && '' + i in checklist.sections">
                    <td
                        colspan="3"
                        class="pa-1 text-caption text-white"
                        style="background: #999"
                        v-html="checklist.sections['' + i]"
                    >
                    </td>
                </tr>
                <tr
                    :class="
                        'item-' +
                        (i % 2 == 0 ? 'even' : 'odd') +
                        (isRowChecked(i) ? ' checked' : '')
                    "
                    style="cursor: pointer"
                    @click="clickRow(i)"
                >
                    <td class="pa-1">
                        <v-icon color="grey" v-if="isRowChecked(i)">mdi-check</v-icon>
                        <v-icon color="grey" v-else>mdi-square-outline</v-icon>
                    </td>
                    <td class="pa-1" style="white-space: pre-wrap" v-html="itemTitle(item)"></td>
                    <td class="pa-1 text-right">
                        <span v-if="itemHasInput(item)">
                            <v-text-field
                                variant="underlined"
                                hide-details
                                reverse
                                style="margin-top: -20px"
                                @click.stop=""
                                :placeholder="itemInputPlaceholder(item)"
                                v-model="inputValues[''+i]"
                                @input="inputItemValue"
                            />
                        </span>
                        <span v-else>
                            {{ itemValue(item) }}
                        </span>
                    </td>
                </tr>
            </template>
        </table>
        <div
            v-if="checklist.postDescription"
            class="pa-2 text-caption text-grey-darken-2"
            style="white-space: pre-wrap"
            v-html="checklist.postDescription"
        ></div>
    </div>
</template>

<style>
tr:hover {
    background: #ccc;
}
tr:not(:hover).item-even {
    background: #ddd;
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
td tt {
    font-size: 13px;
}
</style>

<script setup lang="ts">
import { computed, reactive } from "vue"

const props = defineProps<{
    id: String
    checklist: any
}>()

const checkedRows = reactive([] as number[])
const inputValues = reactive({} as any)

const isAllChecked = computed(() => checkedRows.length == props.checklist.items.length)
const isRowChecked = (index: number) => checkedRows.includes(index)
const itemTitle = (item: string) => item.split("...")[0]
const itemValue = (item: string) => item.split("...")[1] || ""
const itemHasInput = (item: string) => itemValue(item).startsWith("INPUT")
const itemInputPlaceholder = (item: string) => itemValue(item).startsWith("INPUT:") ? itemValue(item).substring(6) : ""

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
    for (const key of Object.keys(inputValues)) delete inputValues[key]
    delete sessionStorage[`checklist_${props.id}_inputValues`]
    delete sessionStorage[`checklist_${props.id}`]
}

function inputItemValue() {
    sessionStorage[`checklist_${props.id}_inputValues`] = JSON.stringify(inputValues)
}

// init

if (`checklist_${props.id}` in sessionStorage) {
    for (const i of JSON.parse(sessionStorage[`checklist_${props.id}`])) checkedRows.push(i)
}
if (`checklist_${props.id}_inputValues` in sessionStorage) {
    Object.assign(inputValues, JSON.parse(sessionStorage[`checklist_${props.id}_inputValues`]))
}
</script>
