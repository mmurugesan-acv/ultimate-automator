<script setup>
import { ref, onMounted, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import LightDarkMode from '@/components/shared/light-dark-mode-changer/LightDarkMode.vue'

const editorContainer = ref(null)
let capturedData = null
let editorInstance = null
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

  // Store the editor instance so we can access its value
  editorInstance = monaco.editor.create(editorContainer.value, {
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

// Function to get the current editor value
function getEditorValue() {
  if (editorInstance) {
    return editorInstance.getValue()
  }
  return ''
}

function runTest() {
  // Get the current editor value (including any user modifications)
  const currentEditorValue = getEditorValue()
  console.log('Current editor content:', currentEditorValue)

  async function triggerTest(userId) {
    const response = await fetch('http://localhost:3000/api/run-tests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: currentEditorValue, // Use actual editor content
        target: "playwrite",
        language: "javascript",
        userId
      })
    })

    const result = await response.json()
    console.log("Streaming output...", result)
  }

  chrome.storage.local.get('githubUserId', result => {
    triggerTest(result.githubUserId)
  })




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
    <div v-show="isLoading" class="fixed inset-0 flex items-center justify-center z-50"
      style="background: linear-gradient(135deg, #282c34 0%, #1e2127 100%);">
      <!-- Animated Background Particles -->
      <div class="absolute inset-0 overflow-hidden">
        <div class="loading-particle loading-particle-1"></div>
        <div class="loading-particle loading-particle-2"></div>
        <div class="loading-particle loading-particle-3"></div>
        <div class="loading-particle loading-particle-4"></div>
        <div class="loading-particle loading-particle-5"></div>
      </div>

      <div class="text-center relative z-10">
        <!-- Main Loading Animation -->
        <div class="relative mb-8">
          <!-- Outer Ring -->
          <div
            class="w-24 h-24 rounded-full border-4 border-transparent border-t-blue-500 border-r-purple-500 animate-spin mx-auto">
          </div>
          <!-- Inner Ring -->
          <div
            class="absolute top-2 left-2 w-20 h-20 rounded-full border-4 border-transparent border-b-green-400 border-l-yellow-400 animate-spin"
            style="animation-direction: reverse; animation-duration: 1.5s;"></div>
          <!-- Center Dot -->
          <div
            class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse">
          </div>
        </div>

        <!-- Animated Text -->
        <div class="mb-6">
          <h2
            class="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-400 via-purple-500 to-green-400 bg-clip-text text-transparent animate-pulse">
            Generating Test Code
          </h2>
          <p class="text-gray-400 animate-fade-in">Please wait while we process your captured events...</p>
        </div>

        <!-- Code Animation -->
        <div class="bg-black/50 rounded-lg p-4 mb-6 font-mono text-sm border border-gray-700">
          <div class="flex items-center mb-2">
            <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <div class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
            <div class="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div class="text-left space-y-1">
            <div class="text-green-400 typewriter">
              <span class="typing-text">await page.goto('your-website.com')</span>
              <span class="cursor">|</span>
            </div>
            <div class="text-blue-400 typewriter" style="animation-delay: 1s;">
              <span class="typing-text">await page.click('.your-button')</span>
              <span class="cursor">|</span>
            </div>
            <div class="text-purple-400 typewriter" style="animation-delay: 2s;">
              <span class="typing-text">expect(page).toHaveTitle('Success')</span>
              <span class="cursor">|</span>
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="w-64 h-2 bg-gray-700 rounded-full mx-auto overflow-hidden">
          <div class="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-400 rounded-full loading-progress">
          </div>
        </div>

        <!-- Status Dots -->
        <div class="flex justify-center mt-6 space-x-2">
          <div class="status-dot status-dot-1"></div>
          <div class="status-dot status-dot-2"></div>
          <div class="status-dot status-dot-3"></div>
          <div class="status-dot status-dot-4"></div>
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
            <button @click="runTest"
              class="absolute top-3 right-10 z-10 px-3 py-1.5 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              style="background-color: #282c34; color: #abb2bf; border: 1px solid #3e4451;">
              <svg class="w-3 h-3 mr-1.5 inline-block" fill="currentColor" viewBox="0 0 20 20">
                <path
                  d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
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
      <div class="fixed inset-y-0 left-0 w-[10%] z-40" @click="closeOverlay"></div>

      <!-- Sliding panel -->
      <div
        class="fixed inset-y-0 right-0 w-[90%] z-50 shadow-xl transform transition-transform duration-500 ease-in-out"
        :class="overlayVisible ? 'translate-x-0' : 'translate-x-full'" style="background-color: #282c34;" @click.stop>
        <!-- Close Button -->
        <button @click="closeOverlay" class="absolute top-4 right-4 z-10 p-2 rounded-full transition-colors"
          style="color: #abb2bf; background-color: #3e4451; border: 1px solid #3e4451;"
          onmouseover="this.style.backgroundColor='#4e5563'" onmouseout="this.style.backgroundColor='#3e4451'">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Overlay Content -->
        <div class="flex h-full">
          <!-- Left Section (60%) -->
          <div class="w-3/5 p-6 border-r" style="border-color: #3e4451;">
            <h2 class="text-xl mb-4" style="color: #abb2bf;">Test Stream</h2>
            <img id="streamImg" src="http://localhost:3001/stream.mjpeg" width="100%" alt="Live Stream">
          </div>

          <!-- Right Section (40%) -->
          <div class="w-2/5 p-6">
            <h2 class="text-xl mb-4" style="color: #abb2bf;">Console Output</h2>
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

/* Loading Screen Animations */
.loading-particle {
  position: absolute;
  width: 4px;
  height: 4px;
  background: linear-gradient(45deg, #3b82f6, #8b5cf6, #10b981);
  border-radius: 50%;
  animation: float 6s infinite linear;
}

.loading-particle-1 {
  top: 20%;
  left: 10%;
  animation-delay: 0s;
  animation-duration: 8s;
}

.loading-particle-2 {
  top: 60%;
  left: 80%;
  animation-delay: 1s;
  animation-duration: 6s;
}

.loading-particle-3 {
  top: 80%;
  left: 20%;
  animation-delay: 2s;
  animation-duration: 10s;
}

.loading-particle-4 {
  top: 30%;
  left: 70%;
  animation-delay: 3s;
  animation-duration: 7s;
}

.loading-particle-5 {
  top: 10%;
  left: 90%;
  animation-delay: 4s;
  animation-duration: 9s;
}

@keyframes float {
  0% {
    transform: translateY(0px) translateX(0px) scale(1);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  50% {
    transform: translateY(-100px) translateX(50px) scale(1.2);
    opacity: 0.8;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-200px) translateX(100px) scale(0.8);
    opacity: 0;
  }
}

.animate-fade-in {
  animation: fadeIn 2s ease-in-out infinite alternate;
}

@keyframes fadeIn {
  0% { opacity: 0.6; }
  100% { opacity: 1; }
}

/* Typewriter Effect */
.typewriter {
  overflow: hidden;
  white-space: nowrap;
  animation: typewriter 3s steps(40) infinite;
}

.typing-text {
  display: inline-block;
}

.cursor {
  animation: blink 1s infinite;
  color: #10b981;
}

@keyframes typewriter {
  0%, 100% { width: 0; }
  50% { width: 100%; }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Progress Bar Animation */
.loading-progress {
  width: 0%;
  animation: progressLoad 4s ease-in-out infinite;
}

@keyframes progressLoad {
  0% { width: 0%; }
  50% { width: 75%; }
  100% { width: 100%; }
}

/* Status Dots */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
  animation: statusPulse 2s infinite;
}

.status-dot-1 {
  animation-delay: 0s;
}

.status-dot-2 {
  animation-delay: 0.3s;
}

.status-dot-3 {
  animation-delay: 0.6s;
}

.status-dot-4 {
  animation-delay: 0.9s;
}

@keyframes statusPulse {
  0%, 80%, 100% {
    background: #6b7280;
    transform: scale(1);
  }
  20% {
    background: linear-gradient(45deg, #3b82f6, #8b5cf6);
    transform: scale(1.3);
  }
}

/* Gradient Background */
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
</style>
