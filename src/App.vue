<template>
  <router-view />
</template>

<script setup lang="ts">
import { RouterView } from "vue-router"
import { useWinBox } from "vue-winbox"

const winbox = useWinBox()
;(window as any).winbox = winbox
</script>
