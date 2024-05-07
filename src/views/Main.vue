<template>
  <div id="topbar">topbar</div>
  <!--<VueWinBox ref="esgg" :options="esggOptions" @move="onMove"> </VueWinBox>
  <VueWinBox ref="essa" :options="essaOptions" @move="onMove"> </VueWinBox>-->
  <VueWinBox :options="{ title: 'ESSA', top: 25 }"><div v-html="wx"></div></VueWinBox>
  <VueWinBox :options="{ title: 'NOTAM', width: 650 }">
    <pre id="notam" v-html="notam" style="padding: 10px"></pre>
  </VueWinBox>
  <vue-win-box :options="{ title: 'other', width: 200, height: 300 }">another window</vue-win-box>
</template>

<style scoped>
#topbar {
  width: 100%;
  height: 25px;
  background: deeppink;
  position: fixed;
  z-index: 100;
}
</style>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import { VueWinBox } from "vue-winbox"
import axios from "axios"

const esgg = ref()
const essa = ref()

const esggOptions = {
  title: "ESGG",
  class: "no-full",
  width: 800,
  height: 480,
  border: "4px",
  url: "https://wx.awos.se/get.aspx?viewId=landvetter-overview.html"
}

const essaOptions = {
  title: "ESSA",
  class: "no-full",
  width: 800,
  height: 400,
  url: "https://wx.awos.se/get.aspx?viewId=arlanda-overview.html"
}

function onMove(hmm: any) {
  console.log("moved", hmm)
}

const wx = ref("hejsan")
const notam = ref("hmm")

onMounted(() => {
  axios.get("https://api.vatscout.com/wx2?viewId=arlanda-overview.html").then((response) => {
    console.log(response.data)
    wx.value = response.data
  })
  axios.get("https://api.vatscout.com/notam").then((response) => {
    const contentDiv = document.createElement("div")
    contentDiv.innerHTML = response.data
    notam.value = contentDiv.getElementsByTagName("pre")[0].innerHTML
  })
})

onUnmounted(() => {
  esgg.value?.winbox.close(true)
  essa.value?.winbox.close(true)
})
</script>
