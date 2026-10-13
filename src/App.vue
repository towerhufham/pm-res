<script setup lang="ts">
import { reactive, ref } from 'vue';
import { GameState } from './core';
import type { Card, AbilityContext, PlayerState, ChainLink, WaitingFor } from './core';
import CardUI from './components/CardUI.vue';
import Modal from './components/Modal.vue';
import { moveUp, moveDown } from "./util.ts";
import { bomb, revivish, reviver, springish, springy, boardwipe } from "./cards";

const us = 0 //our player, todo other views

//this game object should be hidden from the client, so the only allowed usage
//of it for now is this initialization and calling its methods! no peeking in
const game = reactive(new GameState([{main: [bomb, revivish, revivish, reviver, boardwipe], ex: [], worlds: []}]))
const state = ref<PlayerState>(game.getPlayerState(us)) //todo use updatePlayerState() in onMounted

const viewingCard = ref<Card|null>(null)

//all null if we're not currently targeting anything
//todo these are always set and nulled the same so maybe they should be one thing
const targetOptions = ref<Record<string, Card[]>|null>(null)
const targetSelections = ref<Record<string, Card[]>|null>(null)
const targetAc = ref<AbilityContext|null>(null)

//same thing as above more or less, should be a DU UIState type
const triggerOrder = ref<AbilityContext[]>([])
const confirmedTriggers = ref<AbilityContext[]>([]) //this is probably ChainLink[]

//yup, need DU
const responseOptions = ref<AbilityContext[]>([])
const confirmedResponses = ref<AbilityContext[]>([])

const updatePlayerState = () => {
  state.value = game.getPlayerState(us)
  //if it's time to respond, set up ui
  if (state.value.waitingFor.type === "Response window") {
    const responses = state.value.waitingFor.options
    responseOptions.value = [...responses]
    confirmedResponses.value = []
  }
  //if it's time to do triggers, set up ui
  else if (state.value.waitingFor.type === "Triggers") {
    const triggers = state.value.waitingFor.triggerPool
    triggerOrder.value = [...triggers]
    confirmedTriggers.value = [...triggers] //todo maybe should start with mandatory only
  }
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

const submitTriggers = () => {
  //todo validate
  if (state.value.waitingFor.type !== "Triggers") return
  const finalTriggers = triggerOrder.value.filter(ac => 
    ac.ability.style.type === "Trigger"
    && (ac.ability.style.mandatory || confirmedTriggers.value.includes(ac))
  )
  //todo prov
  //todo targeting!!
  const triggersWithNoTargets: ChainLink[] = finalTriggers.map(ac => ({...ac, targets: {}}))
  game.chain!.playerBatchTriggers(us, triggersWithNoTargets)
  triggerOrder.value = []
  confirmedTriggers.value = []
  updatePlayerState()
}

const orderTriggerDown = (trigger: AbilityContext) => {
  triggerOrder.value = moveDown(triggerOrder.value, trigger)
}

const orderTriggerUp = (trigger: AbilityContext) => {
  triggerOrder.value = moveUp(triggerOrder.value, trigger)
}

const toggleTriggerConfirm = (trigger: AbilityContext) => {
  if (trigger.ability.style.type !== "Trigger") return
  if (trigger.ability.style.mandatory) return
  if (confirmedTriggers.value.includes(trigger)) {
    confirmedTriggers.value = confirmedTriggers.value.filter(ac => ac !== trigger)
  } else {
    confirmedTriggers.value.push(trigger)
  }
}

const toggleResponseConfirm = (response: AbilityContext) => {
  if (response.ability.style.type !== "Activated") return
  if (!response.ability.style.quick) return
  if (confirmedResponses.value.includes(response)) {
    confirmedResponses.value = confirmedResponses.value.filter(ac => ac !== response)
  } else {
    confirmedResponses.value.push(response)
  }
}

const confirmResponses = () => {
  //todo targeting
  if (state.value.waitingFor.type !== "Response window") return
  for (const ac of confirmedResponses.value) {
    game.startActivation({...ac, targets: {}})
  }
  responseOptions.value = []
  confirmedResponses.value = []
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
        class="-mb-32 hover:-translate-x-4" @click="cardClick(card)"
      />
    </section>

    <div class="absolute bottom-0 right-0 w-32 h-48 bg-gray-400 flex flex-col justify-center items-center">
      <p class="cursor-pointer select-none" @click="debugDraw">{{state.zoneCounts[us]!["Deck"]}}</p>
    </div>

    <Modal v-if="viewingCard" @dismiss="viewingCard = null">
      <p>Choose ability:</p>
      <div v-for="ability of viewingCard.abilities">
        <p class="border-2 p-1 cursor-pointer transition-all hover:border-blue-500" 
          :class="game.canActivateAbility({player: us, card: viewingCard, ability}) ? '' : 'bg-gray-400'" 
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
      <div class="flex justify-center items-center gap-4 border w-full p-4">
        <div v-for="ac of responseOptions">
          <CardUI class="border-2 p-4 mb-2 cursor-pointer" :class="confirmedResponses.includes(ac) ? `` : `bg-gray-400!`" 
            :card="ac.card" @click="toggleResponseConfirm(ac)"
            />
        </div>
      </div>
      <p v-if="confirmedResponses.length === 0" class="border p-1 cursor-pointer select-none" @click="passPriority">
        Pass priority
      </p>
      <p v-else class="border p-1 cursor-pointer select-none" @click="confirmResponses">
        {{ confirmedResponses.length > 1 ? "Confirm responses" : "Confirm response" }}
      </p>
    </Modal>

    <Modal v-if="state.waitingFor.type === 'Triggers'">
      <p class="mb-4">Order and confirm triggers:</p>
      <div class="flex justify-center items-center gap-4 border w-full p-4">
        <p>Resolves last</p>
        <div v-for="ac of triggerOrder">
          <p class="italic" v-if="ac.ability.style.type === 'Trigger' && ac.ability.style.mandatory">
            (mandatory)
          </p>
          <CardUI class="border-2 p-4 mb-2 cursor-pointer" :class="confirmedTriggers.includes(ac) ? `` : `bg-gray-400!`" 
            :card="ac.card" @click="toggleTriggerConfirm(ac)"
            />
          <div v-if="triggerOrder.length > 1" class="grid grid-cols-3 text-center">
            <div class="border cursor-pointer select-none" @click="orderTriggerDown(ac)">⮜</div>
            <div>&nbsp;</div>
            <div class="border cursor-pointer select-none" @click="orderTriggerUp(ac)">➤</div>
          </div>
        </div>
        <p>Resolves first</p>
      </div>
      <p class="border p-1 cursor-pointer mt-4 select-none" @click="submitTriggers">Submit</p>
    </Modal>
  </div>
</template>
