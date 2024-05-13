<template>
    <pre class="pa-1" style="font-size: 14px; line-height: 16px" v-html="notam.allText"></pre>
</template>

<script setup lang="ts">
import { useNotamStore } from "@/stores/notam";

const notam = useNotamStore()

</script>
