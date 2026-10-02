<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '@/core'

const props = defineProps<{
  card: Card, 
  selectable?: boolean,
  selected?: boolean
}>()

const extraClasses = computed(() => {
  let classes = ""
  if (props.selectable) classes += "hover:border-blue-500 cursor-pointer"
  if (props.selected) classes += "border-yellow-600 cursor-pointer"
  return classes
})
</script>

<template>
  <article :class="`flex flex-col border-4 px-1 transition-all transform ${extraClasses}`">
    <div class="flex justify-between">
      <h2>{{card.name}}</h2>
      <div class="flex">
        <p v-for="color of card.colors">{{color}}</p>
      </div>
    </div>
    <!-- <div class="flex justify-between">
      <p>Level {{card.level}}</p>
      <p>{{fancyText.formatOrder(card.order)}}</p>
    </div> -->
    <!-- <hr/> -->
    <div class="overflow-scroll">
      <p v-for="ability of card.abilities">
        ◆{{ability.style.type}}
      </p>
      <!-- <p v-for="eff of card.triggeredEffects">
        ◇{{fancyText.formatEffect(eff.description)}}
      </p> -->
    </div>
    <!-- {{card.id}} -->
    <!-- <hr/>
    <p class="self-end">
      {{card.psi}}psi ({{card.maxPsi}})
    </p> -->
  </article>
</template>