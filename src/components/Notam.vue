<template>
    <pre v-html="notam"></pre>
</template>

<script setup lang="ts">
import axios from "axios"
import { onMounted, ref } from "vue"

const notam = ref("Loading...")

onMounted(() => {
    axios.get(`https://api.vatiris.se/notam`).then((response) => {
        const el = document.createElement("div")
        el.innerHTML = response.data
        notam.value = el.getElementsByTagName("pre")[0].innerHTML
    })
})
</script>
