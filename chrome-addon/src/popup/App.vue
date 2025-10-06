<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import LightDarkMode from '@/components/shared/light-dark-mode-changer/LightDarkMode.vue';

// Array to store captured events
const capturedEvents = ref([])
const isRecording = ref(false)
const currentTabUrl = ref('')
let pollingInterval = null

// Function to get current tab URL
function getCurrentTabUrl() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      currentTabUrl.value = tabs[0].url
      console.log('Current tab URL:', currentTabUrl.value)
    }
  })
}

const openPortal = () => {
  // Add navigate event with current tab URL to the beginning of capturedEvents
  const eventsWithNavigation = [
    {
      type: 'navigate',
      url: currentTabUrl.value
    },
    ...capturedEvents.value
  ];

  chrome.storage.local.set({ data: eventsWithNavigation }, () => {
    console.log("Data saved with navigation event");
  });

  // Reset the popup state
  resetState();

  chrome.runtime.openOptionsPage();
}

// Reset function to clear state
function resetState() {
  capturedEvents.value = []
  isRecording.value = false
  stopPolling()
  
  // Clear storage
  chrome.storage.local.set({ 
    capturedEvents: [], 
    isRecording: false 
  })
}

// Load events from storage
function loadEvents() {
  chrome.storage.local.get(['capturedEvents', 'isRecording'], (result) => {
    if (result.capturedEvents) {
      capturedEvents.value = result.capturedEvents
    }
    if (result.isRecording !== undefined) {
      isRecording.value = result.isRecording
    }
  })
}

// Start polling for events when recording
function startPolling() {
  if (pollingInterval) return
  
  pollingInterval = setInterval(() => {
    loadEvents()
  }, 500) // Poll every 500ms
}

// Stop polling
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

onMounted(() => {
  loadEvents()
  getCurrentTabUrl() // Get current tab URL when popup opens
  // Check if already recording and start polling if needed
  chrome.storage.local.get(['isRecording'], (result) => {
    if (result.isRecording) {
      startPolling()
    }
  })
})

onUnmounted(() => {
  stopPolling()
})

function play() {
  console.log('Play button clicked')
  isRecording.value = true
  
  // Clear previous events in storage
  chrome.storage.local.set({ capturedEvents: [], isRecording: true })
  capturedEvents.value = []
  
  // Start polling for events
  startPolling()
  
  // Send message to content script to start tracking
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'startTracking' }, (response) => {
      console.log('Tracking started:', response)
    })
  })
}

function stop() {
  console.log('Stop button clicked')
  isRecording.value = false
  
  // Stop polling
  stopPolling()
  
  // Update storage
  chrome.storage.local.set({ isRecording: false })
  
  // Send message to content script to stop tracking
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'stopTracking' }, (response) => {
      console.log('Tracking stopped:', response)
      // Load final events
      loadEvents()
      console.log('Captured events:', capturedEvents.value)
    })
  })
}
</script>

<template>
<Card class="w-[350px]">
  <div class="flex w-full items-start justify-between px-6 pt-6 space-x-4">
    <CardHeader class="flex-1 p-0 min-w-0">
      <CardTitle class="truncate">Ultimate Automator</CardTitle>
      <CardDescription class="truncate">
        Tool to generate E2E test cases
      </CardDescription>
    </CardHeader>

    <LightDarkMode class="shrink-0" />
  </div>

  <CardContent class="flex flex-col items-center">
    <div class="flex gap-4">
      <button
        v-if="!isRecording"
        @click="play"
        class="flex items-center justify-center w-16 h-16 rounded-full bg-white border border-black hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
        aria-label="Play"
      >
        <svg
          class="w-8 h-8 text-black"
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M5 3v18l15-9L5 3z" />
        </svg>
      </button>
      
      <button
        v-if="isRecording"
        @click="stop"
        class="flex items-center justify-center w-16 h-16 rounded-full bg-red-500 border border-red-700 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        aria-label="Stop"
      >
        <svg
          class="w-8 h-8 text-white"
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>
    </div>
    
    <span class="mt-2 text-sm">{{ isRecording ? 'Recording...' : 'Start Recording' }}</span>
    
    <div v-if="capturedEvents.length > 0 && !isRecording" class="mt-4 text-center">
      <a 
        @click="openPortal"
        class="text-sm font-medium text-blue-600 hover:text-blue-800 underline cursor-pointer"
      >
        Open Portal
      </a>
    </div>
  </CardContent>

</Card>
</template>

