<template>
    <div class="text-grey-lighten-1 text-body-2">
      <p class="mb-3">
        VatIRIS is an interpretation of its real-world counterpart
        <a href="https://www.awos.se/sv-se/products/iris.aspx" target="_blank">IRIS</a> -
        Integrated Real-time Information System, but adapted and extended for use by VATSIM
        controllers in Sweden.
      </p>
      <p>It's currently under heavy development, so please expect bugs.</p>
      <p>
        Welcome to file bug reports or feature requests as
        <a href="https://github.com/minsulander/vatiris/issues" target="_blank">issues</a>
      </p>
      <p class="mt-3" v-if="auth.user">
        Logged in as {{ auth.user.personal.name_full }}, {{ auth.user.cid }},
        {{ auth.user.vatsim.rating.short }}
        <span v-if="auth.user.vatsim.subdivision && auth.user.vatsim.subdivision.name">
          from {{ auth.user.vatsim.subdivision.name }}</span
        >
        <span v-else-if="auth.user.vatsim.division && auth.user.vatsim.division.name">
          from {{ auth.user.vatsim.division.name }}</span
        >
      </p>
      <p class="mt-3">
        <router-link class="text-grey-darken-1" to="privacy">Privacy policy</router-link>
      </p>
      <p class="text-grey-darken-1 mt-3">
        Copyright &copy; 2024 Martin Insulander and contributors
      </p>
      <p class="mt-3">
        <a
          class="text-grey-darken-1"
          href="https://github.com/minsulander/vatiris"
          target="_blank"
          ><v-icon>mdi-github</v-icon> VatIRIS on GitHub</a
        >
      </p>
  
      <!-- New buttons for selecting logic -->
      <div class="mt-3">
        Set PLS Logic
        <v-btn
          :color="logic === 'cid' ? 'primary' : 'default'"
          @click="setLogic('cid')"
          class="mr-2"
        >
          CID
        </v-btn>
        <v-btn
          :color="logic === 'position' ? 'primary' : 'default'"
          @click="setLogic('position')"
        >
          Position
        </v-btn>
      </div>
  
      <!-- CID logic -->
      <div v-if="logic === 'cid'" class="mt-3">
        <v-checkbox
          v-model="useVatsimCid"
          label="Use VATSIM connect CID"
          @change="handleCidOption"
        ></v-checkbox>
        <div v-if="!useVatsimCid">
          <v-text-field
            label="CID 1"
            v-model="manualCid1"
            outlined
            dense
          ></v-text-field>
          <v-text-field
            label="CID 2"
            v-model="manualCid2"
            outlined
            dense
          ></v-text-field>
        </div>
      </div>
  
      <!-- Position logic -->
      <div v-if="logic === 'position'" class="mt-3">
        <v-text-field
          label="Position 1"
          v-model="pos1"
          outlined
          dense
        ></v-text-field>
        <v-text-field
          label="Position 2"
          v-model="pos2"
          outlined
          dense
        ></v-text-field>
      </div>
  
      <!-- Apply button -->
      <v-btn color="success" class="mt-3" @click="applyLogic">Apply</v-btn>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, watch } from "vue"
  import { useAuthStore } from "@/stores/auth"
  import axios from "axios"
  import useEventBus from "@/eventbus"
  
  const auth = useAuthStore()
  const bus = useEventBus() // Event bus instance
  
  // Reactive state variables
  const logic = ref("cid") // Default logic set to 'cid'
  const pos1 = ref("")
  const pos2 = ref("")
  const useVatsimCid = ref(true) // Default checkbox state is checked
  const manualCid1 = ref("")
  const manualCid2 = ref("")
  
  // Method to handle logic selection
  const setLogic = (selectedLogic: string) => {
    logic.value = selectedLogic
    console.log(`Selected logic: ${selectedLogic}`)
  
    // Reset relevant fields when logic changes
    if (selectedLogic === "cid") {
      useVatsimCid.value = true
      manualCid1.value = ""
      manualCid2.value = ""
    } else if (selectedLogic === "position") {
      pos1.value = ""
      pos2.value = ""
    }
  }
  
  // Method to handle checkbox change
  const handleCidOption = () => {
    if (useVatsimCid.value) {
      manualCid1.value = ""
      manualCid2.value = ""
    }
  }
  
  // Method to apply the logic selection and emit the event
  const applyLogic = () => {
    let type = logic.value.toUpperCase()
    let value = []
  
    if (logic.value === "cid") {
      if (useVatsimCid.value) {
        // Use VATSIM CID from auth store
        value = [auth.user.cid]
      } else {
        // Use manually entered CIDs
        value = [manualCid1.value, manualCid2.value].filter(v => v)
      }
    } else if (logic.value === "position") {
      // Use positions
      value = [pos1.value, pos2.value].filter(v => v)
    }
  
    // Emit an event to notify PLSTimer.vue of the updated logic
    bus.emit("logicChanged", { type, value })
  
    console.log(`Logic applied: type=${type}, value=${value}`)
  }
  </script>
  
  <style scoped>
  .mt-3 {
    margin-top: 1rem;
  }
  
  .mr-2 {
    margin-right: 0.5rem;
  }
  
  h2 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }
  </style>
  