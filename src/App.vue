<script setup lang="ts">
import { reactive, ref } from 'vue';
import { GameState } from './core';
import type { Card, AbilityContext, PlayerState, ChainLink, WaitingFor } from './core';
import CardUI from './components/CardUI.vue';
import Modal from './components/Modal.vue';
import { moveUp, moveDown } from "./util.ts";
import { bomb, revivish, reviver, springish, springy, boardwipe } from "./cards";
import TargetingBlock from './components/TargetingBlock.vue';

const us = 0 //our player, todo other views

//this game object should be hidden from the client, so the only allowed usage
//of it for now is this initialization and calling its methods! no peeking in
const game = reactive(new GameState([{main: [bomb, revivish, revivish, reviver, boardwipe], ex: [], worlds: []}]))
const state = ref<PlayerState>(game.getPlayerState(us)) //todo use updatePlayerState() in onMounted

const viewingCard = ref<Card|null>(null)

type ClientOnlyState = {
  type: "Standby"
} | {
  type: "Viewing Card"
  card: Card
} | {
  type: "Targeting"
  options: Record<string, Card[]>
  selections: Record<string, Card[]>
  ac: AbilityContext
} | {
  type: "Triggers"
  order: AbilityContext[]
  confirmed: AbilityContext[]
} | {
  type: "Response window"
  options: AbilityContext[] //todo can't this come from the playerstate?
  confirmed: AbilityContext[] //todo order is important here too, right?
}

//todo epiphany: all client state should be in a controller class this thinly wraps
const clientState = ref<ClientOnlyState>({type: "Standby"})

//user toggleable 
const autoPassWhenNoResponses = ref(true)

const updatePlayerState = () => {
  state.value = game.getPlayerState(us)
  //if it's time to respond, set up ui
  if (state.value.waitingFor.type === "Response window") {
    const responses = state.value.waitingFor.options
    if (autoPassWhenNoResponses.value && responses.length === 0) {
      passPriority()
    } else {
      clientState.value = {
        type: "Response window",
        options: [...responses],
        confirmed: []
      }
    }
  }
  //if it's time to do triggers, set up ui
  else if (state.value.waitingFor.type === "Triggers") {
    const triggers = state.value.waitingFor.triggerPool
    clientState.value = {
      type: "Triggers",
      order: [...triggers],
      confirmed: [...triggers] //todo maybe should start with mandatory only
    }
  } else {
    //todo this might be incorrect?
    clientState.value = {type: "Standby"}
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
    clientState. value = {
      type: "Targeting",
      options: optionSets,
      selections: {}, //this gets overwritten by a v-model
      ac
    }
  }
}

const submitTargets = () => {
  //todo validation goes... somewhere
  if (clientState.value.type !== "Targeting") return
  //todo prov
  const ac = clientState.value.ac
  const link: ChainLink = {
    player: us, 
    card: ac.card, 
    ability: ac.ability, 
    targets: clientState.value.selections
  }
  game.startActivation(link)
  updatePlayerState()
}

const submitTriggers = () => {
  //todo validate
  if (state.value.waitingFor.type !== "Triggers") return
  if (clientState.value.type !== "Triggers") return
  const confirmed = clientState.value.confirmed //needed to bring it past function boundary
  const finalTriggers = clientState.value.order.filter(ac => 
    ac.ability.style.type === "Trigger"
    && (ac.ability.style.mandatory || confirmed.includes(ac))
  )
  //todo prov
  //todo targeting!!
  const triggersWithNoTargets: ChainLink[] = finalTriggers.map(ac => ({...ac, targets: {}}))
  game.chain!.playerBatchTriggers(us, triggersWithNoTargets)
  updatePlayerState()
}

const orderTriggerDown = (trigger: AbilityContext) => {
  if (clientState.value.type !== "Triggers") return
  clientState.value.order = moveDown(clientState.value.order, trigger)
}

const orderTriggerUp = (trigger: AbilityContext) => {
  if (clientState.value.type !== "Triggers") return
  clientState.value.order = moveUp(clientState.value.order, trigger)
}

const toggleTriggerConfirm = (trigger: AbilityContext) => {
  if (clientState.value.type !== "Triggers") return
  if (trigger.ability.style.type !== "Trigger") return
  if (trigger.ability.style.mandatory) return
  if (clientState.value.confirmed.includes(trigger)) {
    clientState.value.confirmed = clientState.value.confirmed.filter(ac => ac !== trigger)
  } else {
    clientState.value.confirmed.push(trigger)
  }
}

const toggleResponseConfirm = (response: AbilityContext) => {
  if (clientState.value.type !== "Response window") return
  if (response.ability.style.type !== "Activated") return
  if (!response.ability.style.quick) return
  if (clientState.value.confirmed.includes(response)) {
    clientState.value.confirmed = clientState.value.confirmed.filter(ac => ac !== response)
  } else {
    clientState.value.confirmed.push(response)
  }
}

const confirmResponses = () => {
  //todo these states are often awfully similar...
  if (state.value.waitingFor.type !== "Response window") return
  if (clientState.value.type !== "Response window") return
  for (const ac of clientState.value.confirmed) {
    //todo prov & targeting
    game.startActivation({...ac, targets: {}})
  }
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

    <p class="absolute top-0 left-0 border m-1 p-1 cursor-pointer" @click="autoPassWhenNoResponses = !autoPassWhenNoResponses">
      {{ autoPassWhenNoResponses ? "Auto-passing windows with no responses" : "Always asks for a response" }}
    </p>

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

    <Modal v-if="clientState.type === 'Targeting'">
      <p>Choose target(s):</p>
      <TargetingBlock v-model="clientState.selections" :option-sets="clientState.options"/>
      <p class="border p-1 cursor-pointer select-none" @click="submitTargets">Submit</p>
    </Modal>

    <Modal v-if="clientState.type === 'Response window'">
      <div class="flex justify-center items-center gap-4 border w-full p-4">
        <div v-for="ac of clientState.options">
          <CardUI class="border-2 p-4 mb-2 cursor-pointer" :class="clientState.confirmed.includes(ac) ? `` : `bg-gray-400!`" 
            :card="ac.card" @click="toggleResponseConfirm(ac)"
            />
        </div>
      </div>
      <p v-if="clientState.confirmed.length === 0" class="border p-1 cursor-pointer select-none" @click="passPriority">
        Pass priority
      </p>
      <p v-else class="border p-1 cursor-pointer select-none" @click="confirmResponses">
        {{ clientState.confirmed.length > 1 ? "Confirm responses" : "Confirm response" }}
      </p>
    </Modal>

    <Modal v-if="clientState.type === 'Triggers'">
      <p class="mb-4">Order and confirm triggers:</p>
      <div class="flex justify-center items-center gap-4 border w-full p-4">
        <p>Resolves last</p>
        <div v-for="ac of clientState.order">
          <p class="italic" v-if="ac.ability.style.type === 'Trigger' && ac.ability.style.mandatory">
            (mandatory)
          </p>
          <CardUI class="border-2 p-4 mb-2 cursor-pointer" :class="clientState.confirmed.includes(ac) ? `` : `bg-gray-400!`" 
            :card="ac.card" @click="toggleTriggerConfirm(ac)"
            />
          <div v-if="clientState.order.length > 1" class="grid grid-cols-3 text-center">
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
