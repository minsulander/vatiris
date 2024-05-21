<template>
    <div class="pa-2">
        <p class="mb-3">VatIRIS is an interpretation of its real-world counterpart <a href="https://www.awos.se/sv-se/products/iris.aspx" target="_blank">IRIS</a> - Integrated Real-time Information System,
        but adapted and extended for use by VATSIM controllers in Sweden.</p>
        <p>It's currently under heavy development, so please don't expect things to work.</p>
        <hr class="my-4"/>
    <div class="text-right">
        <v-btn variant="text" @click="resetLayout">Reset window layout</v-btn>
        <v-btn variant="text" @click="resetAll">Reset all settings</v-btn>
    </div>
    </div>
</template>

<script setup lang="ts">
function resetLayout() {
    localStorage.removeItem("layout")
    location.reload()
}
function resetAll() {
    localStorage.clear()
    location.reload()
}
</script>