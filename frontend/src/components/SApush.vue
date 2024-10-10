<template>
    <div>
      <div class="search-and-buttons">
        <div class="search-container">
          <input 
            v-model="searchQuery" 
            @input="searchStand" 
            type="text" 
            placeholder="Stand/Apron"
            class="search-input"
          />
          <button @click="clearSearch" class="clear-button">
            <span class="mdi mdi-close"></span>
          </button>
        </div>
        <ul class="apron-list">
          <li v-for="apron in aprons" :key="apron.id">
            <a 
              :class="{ selected: selectedApron === apron.id }" 
              @click.prevent="setImage(apron.id, apron.imageUrl)" 
              href="#"
            >{{ apron.name }}</a>
          </li>
        </ul>
      </div>
      <div v-if="currentImage" class="image-container">
        <img :src="currentImage" alt="Selected Apron" />
      </div>
    </div>
  </template>
  
  <script>
  export default {
    data() {
      return {
        currentImage: '',
        selectedApron: '',
        searchQuery: '',
        aprons: [
          { id: 'AB', name: 'AB', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaAB.jpg', searchValues: ['AB', '1', '3', '5', '7', '9', '12', '14', '16', '18', '20'] },
          { id: 'BC', name: 'BC', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaBC.jpg', searchValues: ['BC', '11', '13', '15', '17', '19', '32', '34', '36', '38', '40', '42', '44'] },
          { id: 'CD', name: 'CD', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaCD.jpg', searchValues: ['CD', '31', '33', '35', '37', '39', '41', '43', '52', '54', '56', '58'] },
          { id: 'D', name: 'D', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaD.jpg', searchValues: ['D', '57', '55', '53', '60', '60A', '62', '63', '64', '65', '66', '67', '68'] },
          { id: 'Dforts', name: 'D (cont.)', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaDforts.jpg', searchValues: ['102', '104', '106', '108', '110', '112'] },
          { id: 'E', name: 'E', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaE.jpg', searchValues: ['E', '101', '103', '105', '107', '109', '111', '113', '115', '117', '119'] },
          { id: 'F', name: 'F', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaF.jpg', searchValues: ['F', 'F28', 'F28L', 'F28R', 'F30', 'F32', 'F32L', 'F32R', 'F34', 'F36', 'F36L', 'F36R', 'F38', 'F40', 'F42', 'F44'] },
          { id: 'FA', name: 'FA', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaFA.jpg', searchValues: ['FA', '4', '6', '8', '10', 'F29', 'F29L', 'F31', 'F33', 'F35', 'F37', 'F39', 'F39R', 'F39L'] },
          { id: 'G', name: 'G', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaG.jpg', searchValues: ['G', 'G141', 'G142', 'G143', 'G144', 'G145', 'G146', 'G148'] },
          { id: 'J', name: 'J', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaJ.jpg', searchValues: ['J', 'J'] },
          { id: 'K', name: 'K', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaK.jpg', searchValues: ['K', 'K2', 'K3', 'K3A', 'K3B', 'K3C', 'K3D', 'K3E', 'K5', 'K5L', 'K5R', 'K6', 'K7', 'K8', 'K9'] },
          { id: 'R', name: 'R', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaR.jpg', searchValues: ['R', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R10A', 'R10B', 'R10C'] },
          { id: 'S', name: 'S', imageUrl: 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaS.jpg', searchValues: ['S', 'S1', 'S2', 'S3'] },
        ],
      };
    },
    methods: {
      setImage(apron, imageUrl) {
        this.currentImage = imageUrl;
        this.selectedApron = apron;
      },
      searchStand() {
        const query = this.searchQuery.trim().toLowerCase();
        const matchedApron = this.aprons.find(apron => 
          apron.searchValues && apron.searchValues.some(value => 
            value.toLowerCase() === query
          )
        );
        if (matchedApron) {
          this.setImage(matchedApron.id, matchedApron.imageUrl);
        } else {
          this.currentImage = '';
          this.selectedApron = '';
        }
      },
      clearSearch() {
        this.searchQuery = '';
        this.currentImage = '';
        this.selectedApron = '';
      },
    },
  };
  </script>
  
  <style scoped>
.search-and-buttons {
  display: flex;
  align-items: center;
  position: -webkit-sticky;
  position: sticky;
  background-color: #DDDDDD;
  padding: 5px;
}

.search-container {
  margin-right: 10px;
  display: flex;
  align-items: center;
  position: relative;
}

.search-input {
  padding: 8px;
  padding-right: 30px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 120px;
  font-size: 14px;
}

.clear-button {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-button .mdi {
  font-size: 18px;
  color: #999;
}

.clear-button:hover .mdi {
  color: #333;
}

.apron-list {
  list-style-type: none;
  padding: 8;
  display: flex;
  flex-wrap: wrap;
  margin: 0;
}

.apron-list li {
  margin-right: 10px;
  margin-bottom: 5px;
}

.apron-list a {
  display: block;
  padding: 8px;
  background-color: #f0f0f0;
  text-align: center;
  text-decoration: none;
  color: #333;
}

.apron-list a:hover {
  background-color: #ddd;
  border-radius: 0;
}

.apron-list a.selected {
  background-color: #007bff;
  color: white;
}

.image-container {
  margin-top: 5px;
}

img {
  max-width: 100%;
  height: auto;
}
  </style>