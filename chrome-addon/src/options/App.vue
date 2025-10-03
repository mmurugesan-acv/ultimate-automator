<script setup>
import { Button } from '@/components/ui/button'
import { onMounted } from 'vue';
import LightDarkMode from '@/components/shared/light-dark-mode-changer/LightDarkMode.vue';

onMounted(() => {
  // TODO: receive the data for next processing
  chrome.storage.local.get("myData", (result) => {
    console.log("Received data:", result.myData);
  });
})
</script>

<template>
  <LightDarkMode />
  <h1>Options</h1>
  <Button>Click me</Button>
</template>
