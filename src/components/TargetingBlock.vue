<script setup lang="ts">
  import { watch } from 'vue';
  import type { Card } from '@/core';
  import CardUI from './CardUI.vue';

  const props = defineProps<{optionSets: Record<string, Card[]>}>()
  const model = defineModel<Record<string, Card[]>>()

  const setupSelected = () => {
    //due to vue model quirks, we must create a whole new object and assign it!
    const sel: Record<string, Card[]> = {}
    for (const tag of Object.keys(props.optionSets))  {
      sel[tag] = []
    }
    model.value = sel
  }

  watch(() => props.optionSets, setupSelected, {immediate: true})

  const targetClick = (tag: string, card: Card) => {
    if (!model.value || !model.value[tag]) return
    if (model.value[tag].includes(card)) {
      model.value[tag] = model.value[tag].filter(c => c !== card)
    } else {
      model.value[tag].push(card)
    }
  }
</script>

<template>
  <template v-if="model">
    <div v-for="[tag, options] of Object.entries(optionSets)" class="border-2 p-4">
      <p>Tag "{{ tag }}":</p>
      <div class="flex gap-2 justify-center items-center flex-wrap">
        <CardUI v-for="card of options" :card :selectable="true" 
          :selected="model[tag]?.includes(card)" @click="targetClick(tag, card)"
        />
      </div>
    </div>
  </template>
</template>