<script setup>
import { onMounted } from 'vue';

onMounted(() => {
  // TODO: receive the data for next processing
  chrome.storage.local.get("myData", (result) => {
    console.log("Received data:", result.myData);
  });
})
</script>

<template>
  <h1>Options</h1>
</template>
