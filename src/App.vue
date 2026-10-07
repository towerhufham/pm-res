<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { GameState } from './core';
import type { Card, CardDefinition, AbilityContext } from './core';
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

const bomb: CardDefinition = {
  identifier: "TEST-001",
  name: "Bomb",
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
      style: {type: "Activated"},
      conditions: [{type: "In zone", zone: "Field"}],
      targetingGroups: [{type: "Single Target", criteria: [{type: "In Zone", zone: "Field"}], tag: ""}],
      effects: [{type: "Send targets to", to: "GY", tag: ""}]
    }
  ]
}

const us = 0 //our player, todo other views

const game = reactive(new GameState([{main: [bomb, springish], ex: [], worlds: []}]))

onMounted(() => {
  state.value = {
    type: "Open",
    activatable: game.getAllActivatableAbilities(us).map(ac => ac.card)
  }
})

const log = () => {
  console.dir(game)
}

type UIState = {
  type: "Waiting"
} | {
  type: "Open",
  activatable: Card[]
} | {
  type: "Ability",
  card: Card
} | {
  type: "Targeting",
  ac: AbilityContext
  optionSets: Record<string, Card[]>
  selected: Record<string, Card[]>
} | {
  type: "Priority"
}

const state = ref<UIState>({type: "Waiting"})

//todo maybe these functions should just call methods of GameState?
//and then GameState can interpret the clicks based on whatever state
//its in. we still need UIState for the sake of modals (and animations)
//but that makes a little more sense. actually, maybe GameState can
//create entire PlayerUIState types and send them here directly, including
//what we're waiting on, the reason why some cards aren't playable (shown on hover)
//lists of which abilities need ordering/confirming/etc. that seems really
//logical since i plan on splitting GameState into a bunch of files like chain.ts
const cardClick = (card: Card) => {
  if (state.value.type === "Open") {
    state.value = {type: "Ability", card}
  }
}

const abilityClick = (ac: AbilityContext) => {
  if (state.value.type === "Ability") {
    if (ac.ability.targetingGroups.length === 0) {
      game.startActivation({player: us, card: ac.card, ability: ac.ability, targets: {}})
      state.value = {type: "Priority"} //todo
    } else {
      let optionSets: Record<string, Card[]> = {}
      for (const group of ac.ability.targetingGroups) {
        optionSets[group.tag] = game.getAllByCriteria(us, group.criteria)
      }
      state.value = {type: "Targeting", ac, optionSets, selected: {}}
    }
  }
}

const targetClick = (tag: string, card: Card) => {
  if (state.value.type === "Targeting") {
    if (state.value.selected[tag]!.includes(card)) {
      state.value = {
        ...state.value,
        selected: {
          ...state.value.selected,
          [tag]: state.value.selected[tag]!.filter(c => c !== card)
        }
      }
    } else {
      state.value = {
        ...state.value,
        selected: {
          ...state.value.selected,
          [tag]: [...state.value.selected[tag]!, card]
        }
      }
    }
  }
}

const submitTargets = () => {
  //todo validation goes... somewhere
  if (state.value.type === "Targeting") {
    game.startActivation({player: us, card: state.value.ac.card, ability: state.value.ac.ability, targets: state.value.selected})
    //todo
    state.value = {type: "Priority"}
  }
}

const passPriority = () => {
  if (state.value.type === "Priority") {
    game.chain!.playerPasses()
    state.value = {type: "Waiting"} //todo
  }
}

const glowingCards = (): Card[] => {
  if (state.value.type === "Open") {
    return state.value.activatable
  } else {
    return []
  }
}
</script>

<template>
  <div class="h-screen flex flex-col justify-between items-center">
    <div>
      <p @click="log" class="cursor-pointer">Click to log game data</p>
      <p>State: {{ state.type }}</p>
      <p>Chain: {{ game.chain ? game.chain.state : "No chain" }}</p>
    </div>

    <section class="flex gap-1">
      <CardUI v-for="card of game.cardsInZone(us, 'Field')" 
        :card="card" :selectable="glowingCards().includes(card)" 
        class="w-32 h-48 hover:-translate-y-4" @click="cardClick(card)"
        />
    </section>

    <section class="flex gap-1">
      <CardUI v-for="card of game.cardsInZone(us, 'Hand')" 
        :card="card" :selectable="glowingCards().includes(card)" 
        class="w-32 h-48 hover:-translate-y-4" @click="cardClick(card)"
        />
    </section>

    <section class="absolute right-0 top-0 flex flex-col">
      <CardUI v-for="card of game.cardsInZone(us, 'GY')" 
        :card="card" :selectable="glowingCards().includes(card)" 
        class="w-32 hover:-translate-x-4" @click="cardClick(card)"
        />
    </section>

    <div class="absolute bottom-0 right-0 w-32 h-48 bg-gray-400 flex flex-col justify-center items-center">
      <p @click="() => {game.draw(us)}">{{game.cardsInZone(us, "Deck").length}}</p>
    </div>

    <div v-if="state.type === 'Ability'" class="absolute h-screen w-screen flex justify-center items-center bg-[#00000022]">
      <div class="max-w-1/2 max-h-1/2 bg-white flex flex-col justify-center items-center gap-2 p-4">
        <p>Choose ability:</p>
        <div v-for="ability of state.card.abilities">
          <p v-if="game.canActivateAbility({player: us, card: state.card, ability})" class="border-2 p-1 cursor-pointer transition-all hover:border-blue-500" @click="abilityClick({player: us, card: state.card, ability})">◆{{ability.style.type}}</p>
        </div>
      </div>
    </div>

    <div v-if="state.type === 'Targeting'" class="absolute h-screen w-screen flex justify-center items-center bg-[#00000022]">
      <div class="max-w-1/2 max-h-1/2 bg-white flex flex-col justify-center items-center gap-2 p-4">
        <p>Choose target(s):</p>
        <div v-for="[tag, options] of Object.entries(state.optionSets)" class="border-2 p-1">
          <p>Tag "{{ tag }}":</p>
          <div class="flex gap-2 justify-center items-center flex-wrap">
            <CardUI v-for="card of options" :card :selectable="true" :selected="state.selected[tag]!.includes(card)" @click="targetClick(tag, card)"/>
          </div>
        </div>
        <p class="border p-1 cursor-pointer" @click="submitTargets">Submit</p>
      </div>
    </div>

    <div v-if="state.type === 'Priority'" class="absolute h-screen w-screen flex justify-center items-center bg-[#00000022]">
      <div class="max-w-1/2 max-h-1/2 bg-white flex flex-col justify-center items-center gap-2 p-4">
        <p class="border p-1 cursor-pointer" @click="passPriority">Pass priority</p>
      </div>
    </div>
  </div>
</template>
