<template>
    <iframe ref="echarts" src="https://daim.lfv.se/echarts/?x=1764046&y=8000000&z=6r=0&l=001010000100010001001001#" style="margin-top: -50px; height: calc(100% + 50px)"></iframe>
</template>

<script setup lang="ts">
    import { ref } from "vue"
    const echarts = ref()

    // TODO make x, y, z props, and make the URL dynamic

</script>
