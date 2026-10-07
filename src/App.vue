<script setup lang="ts">
import { reactive, ref } from 'vue';
import { GameState } from './core';
import type { Card, CardDefinition, AbilityContext, PlayerState, ChainLink } from './core';
import CardUI from './components/CardUI.vue';
import Modal from './components/Modal.vue';

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

//this game object sjould be hidden from the client, so the only allowed usage
//of it for now is this initialization and calling its methods! no peeking in
const game = reactive(new GameState([{main: [bomb, springish], ex: [], worlds: []}]))
const state = ref<PlayerState>(game.getPlayerState(us)) //todo use updatePlayerState() in onMounted

type Modal = {type: "Ability", card: Card} 
  | {type: "Targeting", ac: AbilityContext, optionSets: Record<string, Card[]>, selected: Record<string, Card[]>}
  | {type: "Response window", options: AbilityContext[], links: ChainLink[]}
  | {type: "Triggers"}

const modal = ref<Modal|null>(null)

const log = () => {
  console.dir(game)
}

const updatePlayerState = () => {
  state.value = game.getPlayerState(us)
  const waitingFor = state.value.waitingFor
  if (waitingFor.type === "Open" || waitingFor.type === "Another player") {
    modal.value = null
  } else if (waitingFor.type === "Response window") {
    //todo this is an exact copy of the object, maybe we only need one of them?
    //front has some additional concerns (like targeting) but that can be its own thing
    modal.value = {type: "Response window", options: waitingFor.options, links: waitingFor.links}
  } else if (waitingFor.type === "Triggers") {
    //todo make this real
    modal.value = {type: "Triggers"}
  }
}

const cardClick = (card: Card) => {
  if (state.value.waitingFor.type === "Open") {
    modal.value = {type: "Ability", card}
  }
}

const abilityClick = (ac: AbilityContext) => {
  if (ac.ability.targetingGroups.length === 0) {
    game.startActivation({player: us, card: ac.card, ability: ac.ability, targets: {}})
    updatePlayerState()
  } else {
    let optionSets: Record<string, Card[]> = {}
    for (const group of ac.ability.targetingGroups) {
      optionSets[group.tag] = game.getAllByCriteria(us, group.criteria)
    }
    modal.value = {type: "Targeting", ac, optionSets, selected: {}}
  }
}

const targetClick = (tag: string, card: Card) => {
  if (modal.value?.type !== "Targeting") return
  if (modal.value.selected[tag]!.includes(card)) {
    modal.value = {
      ...modal.value,
      selected: {
        ...modal.value.selected,
        [tag]: modal.value.selected[tag]!.filter(c => c !== card)
      }
    }
  } else {
    modal.value = {
      ...modal.value,
      selected: {
        ...modal.value.selected,
        [tag]: [...modal.value.selected[tag]!, card]
      }
    }
  }
}

const submitTargets = () => {
  //todo validation goes... somewhere
  if (modal.value?.type !== "Targeting") return
  const link: ChainLink = {
    player: us, 
    card: modal.value.ac.card, 
    ability: modal.value.ac.ability, 
    targets: modal.value.selected
  }
  game.startActivation(link)
  updatePlayerState()
}

const passPriority = () => {
  if (!game.chain) return
  game.chain.playerPasses()
  updatePlayerState()
}

const selectableCards = (): Card[] => {
  if (state.value.waitingFor.type === "Open") {
    return state.value.waitingFor.options.map(ac => ac.card)
  } else {
    return []
  }
}
</script>

<template>
  <div class="h-screen flex flex-col justify-between items-center">
    <div>
      <p @click="log" class="cursor-pointer">Click to log game data</p>
      <p>Waiting for: {{ state.waitingFor.type }}</p>
      <p>Chain: {{ game.chain ? game.chain.state : "No chain" }}</p>
    </div>

    <section class="flex gap-1">
      <CardUI v-for="card of game.cardsInZone(us, 'Field')" 
        :card="card" :selectable="selectableCards().includes(card)" 
        class="w-32 h-48 hover:-translate-y-4" @click="cardClick(card)"
        />
    </section>

    <section class="flex gap-1">
      <CardUI v-for="card of game.cardsInZone(us, 'Hand')" 
        :card="card" :selectable="selectableCards().includes(card)" 
        class="w-32 h-48 hover:-translate-y-4" @click="cardClick(card)"
        />
    </section>

    <section class="absolute right-0 top-0 flex flex-col">
      <CardUI v-for="card of game.cardsInZone(us, 'GY')" 
        :card="card" :selectable="selectableCards().includes(card)" 
        class="w-32 hover:-translate-x-4" @click="cardClick(card)"
        />
    </section>

    <div class="absolute bottom-0 right-0 w-32 h-48 bg-gray-400 flex flex-col justify-center items-center">
      <p @click="() => {game.draw(us)}">{{state.zoneCounts[us]!["Deck"]}}</p>
    </div>

    <Modal v-if="modal?.type === 'Ability'">
      <p>Choose ability:</p>
      <div v-for="ability of modal.card.abilities">
        <p v-if="game.canActivateAbility({player: us, card: modal.card, ability})" class="border-2 p-1 cursor-pointer transition-all hover:border-blue-500" @click="abilityClick({player: us, card: modal.card, ability})">◆{{ability.style.type}}</p>
      </div>
    </Modal>

    <Modal v-if="modal?.type === 'Targeting'">
      <p>Choose target(s):</p>
      <div v-for="[tag, options] of Object.entries(modal.optionSets)" class="border-2 p-1">
        <p>Tag "{{ tag }}":</p>
        <div class="flex gap-2 justify-center items-center flex-wrap">
          <CardUI v-for="card of options" :card :selectable="true" :selected="modal.selected[tag]!.includes(card)" @click="targetClick(tag, card)"/>
        </div>
      </div>
      <p class="border p-1 cursor-pointer" @click="submitTargets">Submit</p>
    </Modal>

    <Modal v-if="modal?.type === 'Response window'">
      <p class="border p-1 cursor-pointer" @click="passPriority">Pass priority</p>
    </Modal>

    <Modal v-if="modal?.type === 'Triggers'">
      <p>comign soon :3</p>
    </Modal>
  </div>
</template>
