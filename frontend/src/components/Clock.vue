<template>
    <span>{{ time }}</span>
</template>

<script setup lang="ts">

import moment from "moment";
import { onMounted, onUnmounted, ref } from "vue"

const time = ref("99:99:99")

let interval: any = undefined

onMounted(() => {
    interval = setInterval(() => {
        const now = new Date()
        time.value = moment().utc().format("HH:mm:ss")
    }, 1000)
})

onUnmounted(() => {
    clearInterval(interval)
})

</script>