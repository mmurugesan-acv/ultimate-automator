<script setup>
import { Button } from '@/components/ui/button'
import { onMounted } from 'vue';
import LightDarkMode from '@/components/shared/light-dark-mode-changer/LightDarkMode.vue';

onMounted(() => {
  chrome.storage.local.get("data", (result) => {
    console.log("Received data:", result.data);
  });
})
</script>

<template>
  <LightDarkMode />
  <h1>Options</h1>
  <Button>Click me</Button>
</template>
