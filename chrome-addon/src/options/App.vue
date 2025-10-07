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
</script>

<template>
  <div class="min-h-screen bg-background text-foreground p-6">
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
          <div class="flex-1 border overflow-hidden">
            <div ref="editorContainer" class="h-full"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap');
</style>
