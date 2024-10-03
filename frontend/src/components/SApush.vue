<template>
    <div>
      <ul class="apron-list">
        <li>
          <a 
            :class="{ selected: selectedApron === 'AB' }" 
            @click.prevent="setImage('AB', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaAB.jpg')" 
            href="#"
          >AB</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'BC' }" 
            @click.prevent="setImage('BC', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaBC.jpg')" 
            href="#"
          >BC</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'CD' }" 
            @click.prevent="setImage('CD', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaCD.jpg')" 
            href="#"
          >CD</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'D' }" 
            @click.prevent="setImage('D', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaD.jpg')" 
            href="#"
          >D</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'Dforts' }" 
            @click.prevent="setImage('Dforts', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaDforts.jpg')" 
            href="#"
          >D (cont.)</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'E' }" 
            @click.prevent="setImage('E', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaE.jpg')" 
            href="#"
          >E</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'F' }" 
            @click.prevent="setImage('F', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaF.jpg')" 
            href="#"
          >F</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'FA' }" 
            @click.prevent="setImage('FA', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaFA.jpg')" 
            href="#"
          >FA</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'G' }" 
            @click.prevent="setImage('G', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaG.jpg')" 
            href="#"
          >G</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'J' }" 
            @click.prevent="setImage('J', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaJ.jpg')" 
            href="#"
          >J</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'K' }" 
            @click.prevent="setImage('K', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaK.jpg')" 
            href="#"
          >K</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'R' }" 
            @click.prevent="setImage('R', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaR.jpg')" 
            href="#"
          >R</a>
        </li>
        <li>
          <a 
            :class="{ selected: selectedApron === 'S' }" 
            @click.prevent="setImage('S', 'https://www.swedavia.net/airport/arlanda/innehall/Digital%20pushback/PlattaS.jpg')" 
            href="#"
          >S</a>
        </li>
      </ul>
      <div v-if="currentImage" class="image-container">
        <img :src="currentImage" alt="Selected Apron" />
      </div>
    </div>
  </template>
  
  <script>
  export default {
    data() {
      return {
        currentImage: '', // This will hold the URL of the selected image
        selectedApron: '', // This will track the currently selected apron
      };
    },
    methods: {
      setImage(apron, imageUrl) {
        this.currentImage = imageUrl;
        this.selectedApron = apron; // Update the selected apron
      },
    },
  };
  </script>
  
  <style scoped>
  .apron-list {
    list-style-type: none; /* Remove bullet points */
    padding: 5px;
    display: flex; /* Make the list items align horizontally */
    flex-wrap: wrap; /* Ensure the items wrap if there's not enough space */
  }
  
  .apron-list li {
    margin-right: 10px; /* Add space between the buttons */
  }
  
  .apron-list a {
    display: block; /* Make the links behave like block elements */
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
    background-color: #007bff; /* Change background color for the selected button */
    color: white; /* Change text color for the selected button */
  }
  
  .image-container {
    margin-top: 5px;
  }
  
  img {
    max-width: 100%;
    height: auto;
  }
  </style>
  