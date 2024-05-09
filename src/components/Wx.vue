<template>
    <pre class="pa-1" style="font-size: 14px; line-height: 16px" v-html="wx"></pre>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"
import axios from "axios"

const props = defineProps<{ id: string }>()

const viewIdByIcao: { [key: string]: string } = {
    ESSA: "arlanda-overview.html",
    ESGG: "landvetter-overview.html"
}

const wx = ref("Weather info...")

onMounted(() => {
    if (props.id in viewIdByIcao) {
    axios.get(`https://api.vatiris.se/wx?viewId=${viewIdByIcao[props.id]}`).then((response) => {
    console.log(response.data)
    wx.value = response.data
  })
}
})
</script>
