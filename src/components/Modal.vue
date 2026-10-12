<script setup lang="ts">
defineEmits(["dismiss"])
</script>

<template>
  <div class="absolute h-screen w-screen flex justify-center items-center bg-[#00000022]" @click.self="$emit('dismiss')">
    <div class="w-1/2 min-h-1/2 overflow-y-auto bg-white flex flex-col justify-center items-center gap-2 p-4">
      <slot/>
    </div>
  </div>
</template>