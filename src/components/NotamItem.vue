<template>
    <div class="pa-1 mb-3" :class="props.item.from && props.item.from.getTime() < Date.now() ? 'text-black' : 'text-grey-darken-2'">
        <pre>{{ props.item.content.trim() }}</pre>
        <v-row no-gutters style="font-size: 12px; width: 100%; opacity: 0.7">
            <v-col cols="4" v-if="props.item.reported">
                REPORTED:
                {{ moment(props.item.reported).utc().format("YYYY-MM-DD HH:mm") }}
            </v-col>
            <v-col cols="4" v-else-if="props.item.from">
                FROM:
                {{ moment(item.from).utc().format("YYYY-MM-DD HH:mm") }}
            </v-col>
            <v-col cols="4" v-if="props.item.to">
                TO:
                {{ moment(props.item.to).utc().format("YYYY-MM-DD HH:mm") }}
                <span v-if="props.item.toEstimated"> EST</span>
            </v-col>
            <v-col cols="4" v-else-if="props.item.permanent">PERMANENT</v-col>
            <v-col cols="4" class="text-right">{{ props.item.id }}</v-col>
        </v-row>
    </div>
</template>

<script setup lang="ts">
import moment from "moment"

const props = defineProps<{ item: any }>()
</script>
