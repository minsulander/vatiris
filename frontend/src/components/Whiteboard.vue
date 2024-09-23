<template>
    <div class="whiteboard">
      <!-- Display data or a loading state -->
      <div v-if="loading">Loading data...</div>
      <div v-else-if="error">{{ error }}</div>
      <div v-else>
        <p v-if="data && data.length">
          <!-- Display the data retrieved from the API -->
          <ul>
            <li v-for="(item, index) in data" :key="index">
              {{ item.cid }}, {{ item.si }}
            </li>
          </ul>
        </p>
        <p v-else>No data available.</p>
      </div>
    </div>
  </template>
  
  <script>
  import axios from 'axios';
  
  export default {
    data() {
      return {
        data: null, // Will hold the API response
        loading: true, // To manage loading state
        error: null, // To handle errors
      };
    },
    methods: {
      async fetchData() {
        try {
          // Make a request to the API
          const response = await axios.get('http://localhost:3000/cidsi');
          this.data = response.data; // Assign the response data
        } catch (err) {
          this.error = 'Failed to load data'; // Handle any errors
          console.error(err);
        } finally {
          this.loading = false; // Set loading to false after the request is done
        }
      },
    },
    mounted() {
      // Fetch the data when the component is mounted
      this.fetchData();
    },
  };
  </script>
  
  <style scoped>
  .whiteboard {
    padding: 20px;
  }
  </style>
  