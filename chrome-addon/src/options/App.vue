<script setup>
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker: function (_, label) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  }
}

import { ref, onMounted, nextTick, computed, watch } from 'vue'
import * as monaco from 'monaco-editor'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import LightDarkMode from '@/components/shared/light-dark-mode-changer/LightDarkMode.vue'
import RaisePR from '@/components/RaisePR.vue'
import TestRunner from '@/components/TestRunner.vue'

const editorContainer = ref(null)
let capturedData = null
let editorInstance = null
const selectedType = ref('playwrite')
const selectedView = ref('javascript')
const generatedCode = ref('')
const isLoading = ref(true)

// Language mapping for different frameworks
const languageMappings = {
  playwrite: ['javascript', 'python', 'java', 'c_sharp'],
  cypress: ['javascript'],
  selenium: ['python'],
  puppeteer: ['javascript']
}

// Display names for better UX
const frameworkDisplayNames = {
  playwrite: 'Playwright',
  cypress: 'Cypress', 
  selenium: 'Selenium',
  puppeteer: 'Puppeteer'
}

const languageDisplayNames = {
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  c_sharp: 'C#',
}

// Computed property for available languages based on selected framework
const availableLanguages = computed(() => {
  return languageMappings[selectedType.value] || []
})

// Watch for framework changes and reset language if not available
const showOverlay = ref(false)
const overlayVisible = ref(false)

// Watch for framework type changes
watch(selectedType, (newType) => {
  const availableLangs = languageMappings[newType] || []
  // If current language is not available for new framework, reset to first available
  if (!availableLangs.includes(selectedView.value)) {
    selectedView.value = availableLangs[0] || 'javascript'
  }
})

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
  monaco.editor.defineTheme('default', {
      base: 'vs-dark',
      inherit: true,
      rules: [
      ],
      colors: {}
      });
  monaco.editor.setTheme('default')

  // Store the editor instance so we can access its value
  editorInstance = monaco.editor.create(editorContainer.value, {
    value: generatedCode.value || 'No code generated yet',
    language: 'javascript',
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
                <SelectItem 
                  v-for="(displayName, key) in frameworkDisplayNames" 
                  :key="key" 
                  :value="key"
                >
                  {{ displayName }}
                </SelectItem>
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
                <SelectItem 
                  v-for="language in availableLanguages" 
                  :key="language" 
                  :value="language"
                >
                  {{ languageDisplayNames[language] || language }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- Right: Run Test, Raise PR, and Theme Toggle -->
        <div class="flex items-center gap-3">
          <TestRunner :editorInstance="editorInstance" />
          <RaisePR :editorInstance="editorInstance" />
          <LightDarkMode />
        </div>
      </div>

      <!-- Main Editor Section -->
      <div class="flex gap-6 h-[calc(100vh-120px)]">
        <!-- Left Panel -->
        <div class="flex flex-col w-[100%]">
          <div class="flex-1 border overflow-hidden relative">
            <div ref="editorContainer" class="h-full"></div>
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
