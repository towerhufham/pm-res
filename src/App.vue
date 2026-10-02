<script setup lang="ts">
import { reactive } from 'vue';
import { GameState } from './core';
import type { CardDefinition } from './core';
import CardUI from './components/CardUI.vue';

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

const us = 0 //our player, todo other views

const game = reactive(new GameState([{main: [springish], ex: [], worlds: []}]))

const log = () => {
  console.dir(game)
}

const glowingCards = (): number[] => {
  return game.getAllActivatableAbilities(us).map(ac => ac.card).map(c => c.id)
}
</script>

<template>
  <div class="h-screen flex flex-col justify-between items-center">
    <div>
      <p @click="log" class="cursor-pointer">Click to log game data</p>
    </div>

    <section class="flex gap-1">
      <CardUI v-for="card of game.cardsInZone(us, 'Field')" 
        :card="card" :selectable="glowingCards().includes(card.id)" 
        class="w-32 h-48 hover:-translate-y-4"
        />
    </section>

    <section class="flex gap-1">
      <CardUI v-for="card of game.cardsInZone(us, 'Hand')" 
        :card="card" :selectable="glowingCards().includes(card.id)" 
        class="w-32 h-48 hover:-translate-y-4"
        />
    </section>

    <section class="absolute right-0 top-0 flex flex-col">
      <CardUI v-for="card of game.cardsInZone(us, 'GY')" 
        :card="card" :selectable="glowingCards().includes(card.id)" 
        class="w-32 hover:-translate-x-4"
        />
    </section>

    <div class="absolute bottom-0 right-0 w-32 h-48 bg-gray-400 flex flex-col justify-center items-center">
      <p @click="() => {game.draw(us)}">{{game.cardsInZone(us, "Deck").length}}</p>
    </div>
  </div>
</template>
