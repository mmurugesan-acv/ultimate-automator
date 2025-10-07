<script setup>
import { ref, onMounted, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import LightDarkMode from '@/components/shared/light-dark-mode-changer/LightDarkMode.vue'

const editorContainer = ref(null)
let capturedData = null
const selectedType = ref('playwrite')
const selectedView = ref('javascript')
const generatedCode = ref('')
const isLoading = ref(true)
const showOverlay = ref(false)
const overlayVisible = ref(false)

onMounted(() => {
  chrome.storage.local.get('data', result => {
    console.log('Received data:', result.data)
    capturedData = result.data || []
    generateCode()
  })
})

async function generateCode() {
  try {
    const response = await fetch('http://localhost:3000/api/generatecode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: capturedData,
        target:  "playwrite",
        language: "javascript"
      })
    })

    const result = await response.json()
    let rawCode = result.data.generatedCode
    
    // Remove <code> tags if present
    if (rawCode.startsWith('<code>') && rawCode.endsWith('</code>')) {
      rawCode = rawCode.slice(6, -7); // Remove <code> and </code>
    }
    
    generatedCode.value = rawCode.trim()
    console.log('Generated code:', generatedCode.value)

  } catch (error) {
    console.error('Failed to generate code:', error)
    generatedCode.value = 'Error: Failed to generate code'
  } finally {
    // Use nextTick to ensure DOM is ready
    nextTick(() => {
      initializeEditor()
      isLoading.value = false
    })
  }
}

function initializeEditor() {
  monaco.editor.defineTheme('onedark-pro', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'string', foreground: '98c379' },
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'number', foreground: 'd19a66' },
    ],
    colors: {
      'editor.background': '#282c34',
      'editor.foreground': '#abb2bf',
      'editor.lineHighlightBackground': '#2c313c',
      'editor.selectionBackground': '#3e4451',
    },
  })

  monaco.editor.create(editorContainer.value, {
    value: generatedCode.value || 'No code generated yet',
    language: 'javascript',
    theme: 'onedark-pro',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 15,
    fontFamily: 'Fira Code, Monaco, Menlo, Consolas, monospace',
    fontLigatures: true,
  })
}

function runTest() {
  showOverlay.value = true
  overlayVisible.value = false // Ensure it starts hidden
  // Use setTimeout to allow DOM to render the initial state
  setTimeout(() => {
    overlayVisible.value = true
  }, 10) // Small delay to trigger animation
}

function closeOverlay() {
  overlayVisible.value = false
  // Wait for animation to complete before hiding the overlay
  setTimeout(() => {
    showOverlay.value = false
  }, 500) // Match the transition duration
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground pt-6 pl-20 pr-20">
    <!-- Loading Screen -->
    <div v-show="isLoading" class="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div class="text-center">
        <!-- Spinner -->
        <div class="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
        
        <!-- Loading Text -->
        <h2 class="text-xl font-semibold mb-2">Generating Test Code</h2>
        <p class="text-muted-foreground">Please wait while we process your captured events...</p>
        
        <!-- Progress Dots -->
        <div class="flex justify-center mt-4 space-x-1">
          <div class="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <div class="w-2 h-2 bg-primary rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
          <div class="w-2 h-2 bg-primary rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
        </div>
      </div>
    </div>
    <div v-show="!isLoading">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <!-- Left: Dropdowns -->
        <div class="flex items-end gap-6">
          <!-- Dropdown 1 -->
          <div class="flex flex-col">
            <label class="text-sm font-medium mb-1 text-muted-foreground">Testing Framework</label>
              <Select v-model="selectedType">
                <SelectTrigger class="w-[160px]">
                  <SelectValue placeholder="Select Framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="playwrite">Playwright</SelectItem>
                  <SelectItem value="cypress">Cypress</SelectItem>
                  <SelectItem value="selenium">Selenium</SelectItem>
                  <SelectItem value="puppeteer">Puppeteer</SelectItem>
                </SelectContent>
              </Select>
          </div>
  
          <!-- Dropdown 2 -->
          <div class="flex flex-col">
             <label class="text-sm font-medium mb-1 text-muted-foreground">Language</label>
              <Select v-model="selectedView">
                <SelectTrigger class="w-[160px]">
                  <SelectValue placeholder="Select Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="c_sharp">C#</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                </SelectContent>
              </Select>
          </div>
        </div>
  
        <!-- Right: Theme Toggle -->
        <LightDarkMode />
      </div>
  
      <!-- Main Editor Section -->
      <div class="flex gap-6 h-[calc(100vh-120px)]">
        <!-- Left Panel -->
        <div class="flex flex-col w-[100%]">
          <div class="flex-1 border overflow-hidden relative">
            <div ref="editorContainer" class="h-full"></div>
            
            <!-- Overlay Button -->
            <button 
              @click="runTest"
              class="absolute top-3 right-10 z-10 px-3 py-1.5 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              style="background-color: #282c34; color: #abb2bf; border: 1px solid #3e4451;"
            >
              <svg class="w-3 h-3 mr-1.5 inline-block" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
              </svg>
              Run Test
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Overlay -->
    <div v-if="showOverlay">
      <!-- Invisible clickable area for the 10% left area to close overlay -->
      <div 
        class="fixed inset-y-0 left-0 w-[10%] z-40"
        @click="closeOverlay"
      ></div>
      
      <!-- Sliding panel -->
      <div 
        class="fixed inset-y-0 right-0 w-[90%] z-50 bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-500 ease-in-out"
        :class="overlayVisible ? 'translate-x-0' : 'translate-x-full'"
        @click.stop
      >
        <!-- Close Button -->
        <button 
          @click="closeOverlay"
          class="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <!-- Overlay Content -->
        <div class="flex h-full">
          <!-- Left Section (60%) -->
          <div class="w-3/5 p-6 border-r border-gray-200 dark:border-gray-700">
            <h2 class="text-xl mb-4">Test Stream</h2>
          </div>

          <!-- Right Section (40%) -->
          <div class="w-2/5 p-6">
            <h2 class="text-xl mb-4">Console Output</h2>
            <div class="bg-black text-green-400 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm">
              <div class="space-y-1">
                <div>$ playwright test</div>
                <div class="text-gray-500">[2024-10-07 14:30:15] Starting test execution...</div>
                <div class="text-blue-400">[INFO] Launching browser: chromium</div>
                <div class="text-blue-400">[INFO] Navigating to: https://example.com</div>
                <div class="text-green-400">[PASS] ✓ Login form validation (2.1s)</div>
                <div class="text-green-400">[PASS] ✓ Button click interaction (1.8s)</div>
                <div class="text-yellow-400">[RUNNING] Form submission test...</div>
                <div class="text-gray-500">Waiting for element: button[type="submit"]</div>
                <div class="animate-pulse">▊</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap');
</style>
