<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import LightDarkMode from '@/components/shared/light-dark-mode-changer/LightDarkMode.vue';
import GitHubIntegration from '@/components/shared/GitHubIntegration.vue';

// Array to store captured events
const capturedEvents = ref([])
const isRecording = ref(false)
const currentTabUrl = ref('')
const isGitHubAuthenticated = ref(false)
const isRepositorySelected = ref(false)
const selectedRepository = ref(null)
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

// Function to check GitHub authentication status
function checkGitHubAuth() {
  chrome.storage.local.get(['githubToken', 'githubUserId'], (result) => {
    isGitHubAuthenticated.value = !!(result.githubToken && result.githubUserId)
    console.log('GitHub authenticated:', isGitHubAuthenticated.value)
  })
}

// Function to check repository selection status
function checkRepositorySelection() {
  chrome.storage.local.get(['selectedRepository'], (result) => {
    if (result.selectedRepository) {
      selectedRepository.value = result.selectedRepository
      isRepositorySelected.value = true
      console.log('Repository selected:', selectedRepository.value)
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
  checkGitHubAuth() // Check GitHub authentication status
  checkRepositorySelection() // Check repository selection status
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

// Function to handle authentication status change
function onAuthStatusChange(authenticated) {
  isGitHubAuthenticated.value = authenticated
  console.log('Auth status changed:', authenticated)
  if (!authenticated) {
    // Reset repository selection when authentication is lost
    isRepositorySelected.value = false
    selectedRepository.value = null
  }
}

// Function to handle repository selection change
function onRepositorySelected(repository) {
  selectedRepository.value = repository
  isRepositorySelected.value = !!repository
  console.log('Repository selected:', repository)
  
  // Store repository selection in storage
  if (repository) {
    chrome.storage.local.set({ selectedRepository: repository })
  } else {
    chrome.storage.local.remove(['selectedRepository'])
  }
}
</script>

<template>
<Card class="w-[350px]">
  <div class="flex w-full items-start justify-between px-6 pt-6 space-x-4">
    <CardHeader class="flex-1 p-0 min-w-0">
      <CardTitle class="truncate">Ultimate Automator</CardTitle>
    </CardHeader>

    <LightDarkMode class="shrink-0" />
  </div>

  <CardContent class="flex flex-col items-center">
    <!-- Recording Controls (only show when GitHub authenticated AND repository selected) -->
    <div v-if="isGitHubAuthenticated && isRepositorySelected" class="flex gap-4">
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
    
    <span v-if="isGitHubAuthenticated && isRepositorySelected" class="mt-2 text-sm">{{ isRecording ? 'Recording...' : 'Start Recording' }}</span>
    
    <div v-if="capturedEvents.length > 0 && !isRecording && isGitHubAuthenticated && isRepositorySelected" class="mt-4 text-center">
      <button 
        @click="openPortal"
        class="relative inline-flex items-center gap-1 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 hover:from-purple-700 hover:via-blue-700 hover:to-cyan-700 text-white font-bold text-sm shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden group"
      >
        <!-- Left sliding arrows with synchronized animation -->
        <div class="flex items-center slide-arrow-group">
          <span>&gt;</span>
          <span>&gt;</span>
          <span>&gt;</span>
        </div>
        
        <!-- Code text with continuous glow effect -->
        <span class="mx-2 font-mono tracking-wider relative animate-pulse">
          CODE
          <span class="absolute inset-0 bg-white opacity-10 blur-sm"></span>
        </span>
        
        <!-- Right sliding arrows with synchronized animation -->
        <div class="flex items-center slide-arrow-group">
          <span>&gt;</span>
          <span>&gt;</span>
          <span>&gt;</span>
        </div>
        
        <!-- Shimmer effect overlay -->
        <div class="absolute inset-0 -top-1 -bottom-1 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
      </button>
    </div>

    <!-- GitHub Integration Component -->
    <div v-if="!isRecording" class="w-full mt-4">
      <GitHubIntegration @auth-change="onAuthStatusChange" @repository-selected="onRepositorySelected" />
    </div>

    <!-- Messages based on authentication and repository selection status -->
    <div v-if="!isGitHubAuthenticated" class="text-center">
      <p class="text-sm text-muted-foreground mb-2">Authenticate with GitHub to start recording actions</p>
    </div>
    
    <div v-else-if="isGitHubAuthenticated && !isRepositorySelected" class="text-center">
      <p class="text-sm text-muted-foreground mb-2">Select a repository to start recording actions</p>
    </div>
    
    <!-- Show selected repository info when both authenticated and repository selected -->
    <div v-if="isGitHubAuthenticated && isRepositorySelected && selectedRepository" class="text-center mt-2">
      <p class="text-xs text-green-600">✓ {{ isRecording ? 'Recording for:' : 'Ready to record for:' }} {{ selectedRepository.name }}</p>
    </div>
    
  </CardContent>

</Card>
</template>

<style scoped>
@keyframes slideRightSync {
  0% {
    transform: translateX(-10px);
    opacity: 0.4;
  }
  50% {
    transform: translateX(10px);
    opacity: 1;
  }
  100% {
    transform: translateX(-10px);
    opacity: 0.4;
  }
}

/* Animate the entire group of arrows together */
.slide-arrow-group {
  animation: slideRightSync 2s infinite ease-in-out;
}
</style>
