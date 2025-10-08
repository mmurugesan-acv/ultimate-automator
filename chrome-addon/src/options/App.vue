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
import { Button } from '@/components/ui/button'
import LightDarkMode from '@/components/shared/light-dark-mode-changer/LightDarkMode.vue'
import RaisePR from '@/components/RaisePR.vue'
import TestRunner from '@/components/TestRunner.vue'
import LoadingScreen from '@/components/LoadingScreen.vue'

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

// Map our language values to Monaco language identifiers
const monacoLanguageMap = {
  'javascript': 'javascript',
  'python': 'python',
  'java': 'java',
  'c_sharp': 'csharp',
  'typescript': 'typescript',
  'ruby': 'ruby'
}

// Computed property for available languages based on selected framework
const availableLanguages = computed(() => {
  return languageMappings[selectedType.value] || []
})

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

async function handleGenerateCode() {
  isLoading.value = true
  try {
    const response = await fetch('http://localhost:3000/api/generatecode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: capturedData,
        target: selectedType.value,
        language: selectedView.value
      })
    })

    const result = await response.json()
    let rawCode = result.data.generatedCode
    
    // Remove <code> tags if present
    if (rawCode.startsWith('<code>') && rawCode.endsWith('</code>')) {
      rawCode = rawCode.slice(6, -7); // Remove <code> and </code>
    }
    
    const newCode = rawCode.trim()
    generatedCode.value = newCode
    
    // Update the editor with new code and language
    if (editorInstance) {
      editorInstance.setValue(newCode)
      
      const monacoLanguage = monacoLanguageMap[selectedView.value] || 'javascript'
      monaco.editor.setModelLanguage(editorInstance.getModel(), monacoLanguage)
    }
    
    console.log('Generated code:', newCode)
  } catch (error) {
    console.error('Failed to generate code:', error)
    const errorMessage = 'Error: Failed to generate code'
    generatedCode.value = errorMessage
    if (editorInstance) {
      editorInstance.setValue(errorMessage)
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground pt-6 pl-20 pr-20">
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
              <SelectItem v-for="(displayName, key) in frameworkDisplayNames" :key="key" :value="key">
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
              <SelectItem v-for="language in availableLanguages" :key="language" :value="language">
                {{ languageDisplayNames[language] || language }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Generate Code Button -->
        <div class="flex flex-col">
          <label class="text-sm font-medium mb-1 text-muted-foreground opacity-0">Generate</label>
          <Button 
            @click="handleGenerateCode" 
            :disabled="isLoading"
            variant="default"
            class="h-9 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
          >
            Generate Code
            <svg class="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </Button>
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

    <!-- Loading Screen Component -->
    <LoadingScreen :isVisible="isLoading" />
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap');
</style>
