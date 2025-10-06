<script setup>
import { Button } from '@/components/ui/button'
import LightDarkMode from '@/components/shared/light-dark-mode-changer/LightDarkMode.vue';

const openOptions = () => {
  // TODO: Need to pass the actions data from here to options
  const sampleData = { foo: "bar", count: 42 };

  chrome.storage.local.set({ myData: sampleData }, () => {
    console.log("Data saved");
  });

  chrome.runtime.openOptionsPage();
}
</script>

<template>
  <LightDarkMode />
  <h1>Pop</h1>
  <Button @click="openOptions">Click me</Button>
</template>
