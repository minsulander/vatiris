<template>
    <div class="mb-3" :class="props.item.inEffect ? 'text-black' : 'text-grey-darken-2'">
        <pre class="pa-1">{{ props.item.content.trim() }}</pre>
        <v-container class="pa-1">
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
                </v-col>
                <v-col cols="4" v-else-if="props.item.permanent">PERMANENT</v-col>
                <v-col cols="4" class="text-right">{{ props.item.id }}</v-col>
            </v-row>
        </v-container>
    </div>
</template>

<script setup lang="ts">
import moment from "moment"

const props = defineProps<{ item: any }>()
</script>
