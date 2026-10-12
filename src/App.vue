<script setup lang="ts">
import { reactive, ref } from 'vue';
import { GameState } from './core';
import type { Card, AbilityContext, PlayerState, ChainLink, WaitingFor } from './core';
import CardUI from './components/CardUI.vue';
import Modal from './components/Modal.vue';

import { bomb, springish, springy } from "./cards";

const us = 0 //our player, todo other views

//this game object should be hidden from the client, so the only allowed usage
//of it for now is this initialization and calling its methods! no peeking in
const game = reactive(new GameState([{main: [bomb, springish, springy], ex: [], worlds: []}]))
const state = ref<PlayerState>(game.getPlayerState(us)) //todo use updatePlayerState() in onMounted

const viewingCard = ref<Card|null>(null)

//all null if we're not currently targeting anything
//todo these are always set and nulled the same so maybe they should be one thing
const targetOptions = ref<Record<string, Card[]>|null>(null)
const targetSelections = ref<Record<string, Card[]>|null>(null)
const targetAc = ref<AbilityContext|null>(null)

const updatePlayerState = () => {
  state.value = game.getPlayerState(us)
}

const cardClick = (card: Card) => {
  if (state.value.waitingFor.type === "Open") {
    viewingCard.value = card
  }
}

const abilityClick = (ac: AbilityContext) => {
  viewingCard.value = null
  if (ac.ability.targetingGroups.length === 0) {
    //todo prov
    game.startActivation({player: us, card: ac.card, ability: ac.ability, targets: {}})
    updatePlayerState()
  } else {
    let optionSets: Record<string, Card[]> = {}
    for (const group of ac.ability.targetingGroups) {
      optionSets[group.tag] = game.getAllByCriteria(us, group.criteria)
    }
    targetOptions.value = optionSets
    //todo fix this because it's really dumb
    targetSelections.value = {}
    for (const [tag, _] of Object.entries(optionSets)) {
      targetSelections.value[tag] = []
    }
    targetAc.value = ac
  }
}

const targetClick = (tag: string, card: Card) => {
  if (!targetSelections.value || !targetSelections.value[tag]) return
  if (targetSelections.value[tag].includes(card)) {
    targetSelections.value[tag] = targetSelections.value[tag].filter(c => c !== card)
  } else {
    targetSelections.value[tag].push(card)
  }
}

const submitTargets = () => {
  //todo validation goes... somewhere
  if (!targetAc.value) return
  //todo prov
  const link: ChainLink = {
    player: us, 
    card: targetAc.value.card, 
    ability: targetAc.value.ability, 
    targets: targetSelections.value!
  }
  game.startActivation(link)
  targetOptions.value = null
  targetSelections.value = null
  targetAc.value = null
  updatePlayerState()
}

const passPriority = () => {
  if (state.value.waitingFor.type !== "Response window") return
  //todo prov
  game.chain!.playerPasses()
  updatePlayerState()
}

const selectableCards = (): Card[] => {
  if (state.value.waitingFor.type === "Open") {
    return state.value.waitingFor.options.map(ac => ac.card)
  } else {
    return []
  }
}

const debugDraw = () => {
  game.draw(us)
  updatePlayerState()
}
</script>

<template>
  <div class="h-screen flex flex-col justify-between items-center">
    <div>
      <p>Waiting for: {{ state.waitingFor.type }}</p>
      <p>Chain: {{ game.chain ? game.chain.state : "No chain" }}</p>
    </div>

    <section class="flex gap-1">
      <CardUI v-for="card of game.cardsInZone(us, 'Field')" 
        :card="card" :selectable="selectableCards().includes(card)" 
        class="hover:-translate-y-4" @click="cardClick(card)"
      />
    </section>

    <section class="flex gap-1">
      <CardUI v-for="card of game.cardsInZone(us, 'Hand')" 
        :card="card" :selectable="selectableCards().includes(card)" 
        class="hover:-translate-y-4" @click="cardClick(card)"
      />
    </section>

    <section class="absolute right-0 top-0 flex flex-col">
      <CardUI v-for="card of game.cardsInZone(us, 'GY')" 
        :card="card" :selectable="selectableCards().includes(card)" 
        class="w-32 hover:-translate-x-4" @click="cardClick(card)"
      />
    </section>

    <div class="absolute bottom-0 right-0 w-32 h-48 bg-gray-400 flex flex-col justify-center items-center">
      <p class="cursor-pointer select-none" @click="debugDraw">{{state.zoneCounts[us]!["Deck"]}}</p>
    </div>

    <Modal v-if="viewingCard">
      <p>Choose ability:</p>
      <div v-for="ability of viewingCard.abilities">
        <p v-if="game.canActivateAbility({player: us, card: viewingCard, ability})" 
          class="border-2 p-1 cursor-pointer transition-all hover:border-blue-500" 
          @click="abilityClick({player: us, card: viewingCard, ability})"
        >
          ◆{{ability.text}}
        </p>
      </div>
    </Modal>

    <Modal v-if="targetSelections && targetOptions">
      <p>Choose target(s):</p>
      <div v-for="[tag, options] of Object.entries(targetOptions)" class="border-2 p-4">
        <p>Tag "{{ tag }}":</p>
        <div class="flex gap-2 justify-center items-center flex-wrap">
          <CardUI v-for="card of options" :card :selectable="true" 
            :selected="targetSelections[tag]!.includes(card)" @click="targetClick(tag, card)"
          />
        </div>
      </div>
      <p class="border p-1 cursor-pointer select-none" @click="submitTargets">Submit</p>
    </Modal>

    <Modal v-if="state.waitingFor.type === 'Response window'">
      <p class="border p-1 cursor-pointer select-none" @click="passPriority">Pass priority</p>
    </Modal>

    <Modal v-if="state.waitingFor.type === 'Triggers'">
      <p class="mb-4">Order and confirm triggers:</p>
      <div class="flex justify-center items-center gap-4 border w-full p-4">
        <p>Resolves last</p>
        <div v-for="ac of state.waitingFor.triggerPool.filter(ac => ac.card.controlledBy === ac.player)">
          <p class="italic" v-if="ac.ability.style.type === 'Trigger' && ac.ability.style.mandatory">
            (mandatory)
          </p>
          <CardUI class="border-2 p-4 mb-2" :card="ac.card"/>
          <div class="grid grid-cols-3 text-center">
            <div class="border cursor-pointer select-none">⮜</div>
            <div>&nbsp;</div>
            <div class="border cursor-pointer select-none">➤</div>
          </div>
        </div>
        <p>Resolves first</p>
      </div>
      <p class="border p-1 cursor-pointer mt-4 select-none" @click="passPriority">Submit</p>
    </Modal>
  </div>
</template>
