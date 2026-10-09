<template>
    <div
        class="pa-1 mb-3"
        :data-notam-id="item.id"
        :class="item.from && item.from.getTime() > Date.now() ? 'text-grey-darken-2' : 'text-black'"
    >
        <div v-if="item.type == 'ref'" class="text-grey-darken-2">
            SEE NOTAM
            <a v-if="refExists" href="#" @click.prevent="emit('showRef', item.refId!)">{{
                item.refId
            }}</a>
            <span v-else>{{ item.refId }}</span>
            <span v-if="item.refLocation"> ({{ item.refLocation }})</span>
        </div>
        <template v-else>
            <div v-if="item.type == 'snowtam'" class="font-weight-bold">SNOWTAM</div>
            <pre>{{ item.text }}</pre>
            <v-row no-gutters style="font-size: 12px; width: 100%; opacity: 0.7">
                <v-col cols="4" v-if="item.from">
                    FROM:
                    {{ moment(item.from).utc().format("YYYY-MM-DD HH:mm") }}
                </v-col>
                <v-col cols="4" v-if="item.to">
                    TO:
                    {{ moment(item.to).utc().format("YYYY-MM-DD HH:mm") }}
                    <span v-if="item.toEstimated"> EST</span>
                </v-col>
                <v-col cols="4" v-else-if="item.permanent">PERMANENT</v-col>
                <v-col cols="4" v-else></v-col>
                <v-col cols="4" class="text-right">{{ item.id }}</v-col>
                <v-col cols="12" v-if="item.schedule">SCHEDULE: {{ item.schedule }}</v-col>
            </v-row>
        </template>
    </div>
</template>

<script setup lang="ts">
import type { Notam } from "@/stores/notam"
import moment from "moment"

defineProps<{ item: Notam; refExists?: boolean }>()
const emit = defineEmits<{ showRef: [id: string] }>()
</script>
