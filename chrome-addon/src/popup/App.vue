<script setup>
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
  <h1>PopUp</h1>
  <button @click="openOptions">Open Options</button>
</template>
