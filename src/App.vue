<script setup lang="ts">
  import { reactive } from 'vue';
  import { GameState } from './core';
  import type { CardDefinition } from './core';

  const springish: CardDefinition = {
    identifier: "TEST-004",
    name: "Springy",
    colors: [],
    cardType: "Esper",
    ex: false,
    abilities: [
      {
        style: {type: "Activated"},
        conditions: [{type: "In zone", zone: "Hand"}],
        targetingGroups: [],
        effects: [{type: "Summon this"}]
      }, {
        style: {type: "Trigger", mandatory: false, trigger: {type: "This moves", to: "Field"}},
        targetingGroups: [],
        effects: [{type: "Send this to", to: "Hand"}]
      }
    ]
  }

  const game = reactive(new GameState([{main: [springish], ex: [], worlds: []}]))

  const log = () => {
    console.dir(game)
  }
</script>

<template>
  <div class="h-screen flex flex-col justify-between items-center">
    <div>
      <p @click="log" class="cursor-pointer">Click to log game data</p>
    </div>
  </div>
</template>

<style scoped></style>
