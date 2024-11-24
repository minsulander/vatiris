<template>
  <div class="gg-push">
    <table>
      <thead>
        <tr>
          <th class="text-left">Stand</th>
          <th>Facing N</th>
          <th>Facing S</th>
          <th>Long/Extended Push</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in groupedPushData" :key="index">
          <td>
            <span v-for="(stand, standIndex) in row.stands" :key="standIndex">
              <span
                :title="getTooltip(stand)"
                style="cursor: help"
              >{{ stand }}</span>{{ standIndex < row.stands.length - 1 ? ', ' : '' }}
            </span>
          </td>
          <td class="text-center">{{ row.north }}</td>
          <td class="text-center">{{ row.south }}</td>
          <td>{{ row.extended }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'GGpush',
  computed: {
    groupedPushData() {
      const groups = [
        ['5', '5A'],
        ['6', '7', '7A'],
        ['8'],
        ['9'],
        ['10', '11', '12'],
        ['13', '14'],
        ['15'],
        ['16'],
        ['17'],
        ['19'],
        ['20'],
        ['21'],
        ['22A'],
        ['22'],
        ['22B'],
        ['23A'],
        ['23', '23B', '30'],
        ['32'],
        ['34', '36', '38', '40'],
        ['41', '41A'],
        ['46', '48', '50', '52', '54', '56', '58', '60', '62'],
        ['68', '70'],
        ['72', '74', '76', '78']
      ];

      return groups.map(standGroup => {
        const rows = this.pushData.filter(row => standGroup.includes(row.stand));
        return {
          stands: standGroup,
          stand: standGroup.join(', '),
          north: rows.some(r => r.north) ? 'X' : '',
          south: rows.map(r => r.south)
            .filter(Boolean)
            .map(s => s === 'X' ? s : s.replace('X\n', 'X '))
            .filter((value, index, self) => {
              return value === 'X' ? self.indexOf(value) === index : true;
            })
            .join('\n'),
          extended: [...new Set(rows.map(r => r.extended))].filter(Boolean).join(', ')
        };
      });
    }
  },
  methods: {
    getTooltip(stand) {
      const standData = this.pushData.find(row => row.stand === stand);
      if (!standData) return '';
      
      let tooltip = '--Blocks--\n';
      if (standData.blocksNorth) tooltip += `N: ${standData.blocksNorth}\n`;
      if (standData.blocksSouth) tooltip += `S: ${standData.blocksSouth}\n`;
      if (standData.blocksExtended) tooltip += `Long/Ext: ${standData.blocksExtended}`;
      return tooltip.trim();
    }
  },
  data() {
    return {
      pushData: [
        { stand: '5', north: 'X', south: '', extended: '', blocksNorth: '6, 7, 7A, 8, 46, 48', blocksSouth: '', blocksExtended: '' },
        { stand: '5A', north: 'X', south: '', extended: '', blocksNorth: '7, 7A, 8, 9, 10, 46, 48, 50', blocksSouth: '', blocksExtended: '' },
        { stand: '6', north: 'X', south: 'X', extended: '', blocksNorth: '7, 7A, 8, 9, 48', blocksSouth: '5, 46, 48', blocksExtended: '' },
        { stand: '7', north: 'X', south: 'X', extended: '', blocksNorth: '8, 9, 50', blocksSouth: '5, 5A, 6, 46, 48', blocksExtended: '' },
        { stand: '7A', north: 'X', south: 'X', extended: '', blocksNorth: '9, 10, 11, 50, 52', blocksSouth: '5, 5A, 6, 46, 48', blocksExtended: '' },
        { stand: '8', north: 'X', south: 'X', extended: 'North (TWY G)', blocksNorth: '9, 10, 50, 52', blocksSouth: '5, 5A, 6, 7, 46, 48', blocksExtended: '9, 10, 11, 50, 52' },
        { stand: '9', north: 'X', south: 'X', extended: '', blocksNorth: '10, 11, 50, 52', blocksSouth: '6, 7, 7A, 8, 48', blocksExtended: '' },
        { stand: '10', north: 'X', south: 'X', extended: 'South (TWY G)', blocksNorth: '11, 12, 52, 54', blocksSouth: '7A, 8, 9, 50', blocksExtended: '7, 7A, 8, 9, 48, 50' },
        { stand: '11', north: 'X', south: 'X', extended: 'South (TWY G)', blocksNorth: '12, 13, 52, 54', blocksSouth: '9, 10, 50, 52', blocksExtended: '7, 7A, 8, 9, 48, 50' },
        { stand: '12', north: 'X', south: 'X', extended: 'South (TWY G)', blocksNorth: '13, 14, 54', blocksSouth: '10, 11, 50, 52', blocksExtended: '7, 7A, 8, 9, 48, 50' },
        { stand: '13', north: 'X', south: 'X', extended: 'North (TWY H)', blocksNorth: '14, 15, 56, 58', blocksSouth: '11, 12, 52, 54', blocksExtended: '14, 15, 16, 17, 56, 58, 60' },
        { stand: '14', north: 'X', south: 'X', extended: 'North (TWY H)', blocksNorth: '15, 16, 56, 58', blocksSouth: '13', blocksExtended: '15, 16, 17, 56, 58, 60' },
        { stand: '15', north: 'X', south: 'X', extended: '', blocksNorth: '16, 17, 56, 58, 60', blocksSouth: '13, 14, 54', blocksExtended: '' },
        { stand: '16', north: 'X', south: 'X', extended: 'South (TWY H)', blocksNorth: '17, 58, 60, 62', blocksSouth: '14, 15, 56', blocksExtended: '13, 14, 15, 54, 56' },
        { stand: '17', north: 'X', south: 'X', extended: '', blocksNorth: '19, 62', blocksSouth: '15, 16, 56, 58, 60', blocksExtended: '' },
        { stand: '19', north: 'X', south: 'X', extended: 'North (TWY J)', blocksNorth: '20', blocksSouth: '17, 58, 60, 62', blocksExtended: '20, 21' },
        { stand: '20', north: 'X', south: 'X', extended: '', blocksNorth: '21, 22A (Code D+: 21, 22A/B)', blocksSouth: '19, 62 ', blocksExtended: '' },
        { stand: '21', north: 'X', south: 'X\n(max code C)', extended: '', blocksNorth: '22A/B (Code D+: 22A/B, 23A/B)', blocksSouth: '19, 20', blocksExtended: '' },
        { stand: '22A', north: 'X', south: 'X', extended: '', blocksNorth: '22A/B, 23A/B', blocksSouth: '20, 21', blocksExtended: '' },
        { stand: '22', north: '', south: 'X', extended: '', blocksNorth: '', blocksSouth: '20, 21', blocksExtended: '' },
        { stand: '22B', north: 'X', south: 'X', extended: '', blocksNorth: '23A/B', blocksSouth: '21, 22', blocksExtended: '' },
        { stand: '23A', north: 'X (long only)', south: 'X', extended: '', blocksNorth: '23B, 30, 32, 34, 68, 70, 72', blocksSouth: '22A/B', blocksExtended: '' },
        { stand: '23', north: '', south: 'X', extended: '', blocksNorth: '', blocksSouth: '21, 22A/B', blocksExtended: '' },
        { stand: '23B', north: '', south: 'X', extended: '', blocksNorth: '', blocksSouth: '22A/B, 23A', blocksExtended: '' },
        { stand: '30', north: '', south: 'X', extended: '', blocksNorth: '', blocksSouth: '32, 34, 70, 72, 74', blocksExtended: '' },
        { stand: '32', north: 'X', south: '', extended: '', blocksNorth: '34, 36, 70, 72, 74, 76', blocksSouth: '', blocksExtended: '' },
        { stand: '34', north: 'X', south: 'X', extended: '', blocksNorth: '36, 38, 74, 76', blocksSouth: '30, 32, 68, 70, 72', blocksExtended: '' },
        { stand: '36', north: 'X', south: 'X', extended: '', blocksNorth: '38, 40, 74, 76, 78', blocksSouth: '32, 34, 70, 72, 74', blocksExtended: '' },
        { stand: '38', north: 'X', south: 'X', extended: '', blocksNorth: '40, 41, 78', blocksSouth: '34, 36, 72, 72, 76', blocksExtended: '' },
        { stand: '40', north: 'X', south: 'X', extended: '', blocksNorth: '41, 41A, 78', blocksSouth: '36, 38, 74, 76, 78', blocksExtended: '' },
        { stand: '41', north: '', south: 'X', extended: '', blocksNorth: '', blocksSouth: '38, 40, 76, 78 (Code D+: 34,36,38,40, 74, 76, 78)', blocksExtended: '' },
        { stand: '41A', north: '', south: 'X', extended: '', blocksNorth: '', blocksSouth: '38,40, 76, 78', blocksExtended: '' },
        { stand: '46', north: 'X', south: 'X', extended: '', blocksNorth: '5, 6, 7, 46, 48', blocksSouth: '5, 6, 46', blocksExtended: '' },
        { stand: '48', north: 'X', south: 'X', extended: '', blocksNorth: '7, 7A, 8, 9, 48', blocksSouth: '46, 48, 5, 6, 7, 7A', blocksExtended: '' },
        { stand: '50', north: 'X', south: 'X', extended: '', blocksNorth: '9, 10, 11, 50, 52', blocksSouth: '7A, 8, 9, 10, 50', blocksExtended: '' },
        { stand: '52', north: 'X', south: 'X', extended: '', blocksNorth: '11, 12, 13, 52, 54', blocksSouth: '10, 11, 12, 50, 52', blocksExtended: '' },
        { stand: '54', north: 'X', south: 'X', extended: '', blocksNorth: '12, 13, 14, 54', blocksSouth: '12, 13, 52, 54', blocksExtended: '' },
        { stand: '56', north: 'X', south: 'X', extended: '', blocksNorth: '15, 16, 17, 56, 58, 60', blocksSouth: '14, 15, 56', blocksExtended: '' },
        { stand: '58', north: 'X', south: 'X', extended: '', blocksNorth: '16, 17, 58, 60', blocksSouth: '15, 16, 56, 58', blocksExtended: '' },
        { stand: '60', north: 'X', south: 'X', extended: '', blocksNorth: '17, 19, 60, 62', blocksSouth: '16, 17, 56, 58, 60', blocksExtended: '' },
        { stand: '62', north: 'X', south: 'X', extended: '', blocksNorth: '19, 20, 62', blocksSouth: '16, 17, 19, 58, 60, 62', blocksExtended: '' },
        { stand: '68', north: 'X', south: '', extended: '', blocksNorth: '30, 32, 70, 72', blocksSouth: '', blocksExtended: '' },
        { stand: '70', north: 'X', south: '', extended: '', blocksNorth: '32, 34, 36, 72, 74', blocksSouth: '', blocksExtended: '' },
        { stand: '72', north: 'X', south: 'X', extended: '', blocksNorth: '34, 36, 38, 74, 76', blocksSouth: '23B, 30, 32, 68, 70', blocksExtended: '' },
        { stand: '74', north: 'X', south: 'X', extended: '', blocksNorth: '36, 38, 40, 76, 78', blocksSouth: '30, 32, 34, 70, 72', blocksExtended: '' },
        { stand: '76', north: 'X', south: 'X', extended: '', blocksNorth: '38, 40, 41, 78', blocksSouth: '32, 34, 36, 72, 74', blocksExtended: '' },
        { stand: '78', north: 'X', south: 'X', extended: '', blocksNorth: '40, 41, 41A', blocksSouth: '36, 38, 40, 74, 76 (Code D+: 34, 36, 38, 40, 72, 74, 76)', blocksExtended: '' }
      ]
    };
  }
};
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}

th {
  background-color: #9E9E9E;
  color: #ffffff;
  padding: 6px;
  text-align: center;
  font-weight: bold;
  max-width: 300px;
}

td {
  padding: 6px;
  max-width: 300px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-line;
}

tbody tr:nth-child(even) {
  background-color: #f9f9f9;
}

tbody tr:hover {
  background-color: #f2f2f2;
}

.text-center {
  text-align: center;
}
</style>