<template>
    <v-dialog v-if="model" v-model="show" max-width="400">
        <v-card>
            <v-card-title class="headline ml-2 mt-2">{{ 'title' in model ? model.title : 'Please confirm'}}</v-card-title>
            <v-card-text v-html="model.text || 'Are you sure?'"></v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" color="secondary" @click="show = false">Cancel</v-btn>
                <v-btn variant="text" color="primary" @click="click">{{ model.action || 'Yes' }}</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script lang="ts" setup>

import { computed } from "vue"

const model = defineModel<any>()
const show = computed({get() { return !!(model.value && model.value.callback) }, set(value: boolean) { model.value.callback = value }})

function click() {
    if (model.value.callback) {
        model.value.callback()
        model.value.callback = undefined
    }
}

</script>
