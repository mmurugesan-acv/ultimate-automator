<script setup>
import { ref, defineProps } from 'vue'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const props = defineProps({
  editorInstance: Object
})

const isOpen = ref(false)
const isRunning = ref(false)

function openTestRunner() {
  isOpen.value = true
}

function closeTestRunner() {
  isOpen.value = false
}

async function runTest() {
  if (!props.editorInstance) {
    console.error('Editor instance not available')
    return
  }

  const currentEditorValue = props.editorInstance.getValue()
  console.log('Current editor content:', currentEditorValue)

  isRunning.value = true

  try {
    // Get userId from Chrome storage
    const result = await new Promise((resolve) => {
      chrome.storage.local.get('githubUserId', resolve)
    })

    const response = await fetch('http://localhost:3000/api/run-tests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: currentEditorValue,
        target: "playwrite",
        language: "javascript",
        userId: result.githubUserId
      })
    })

    const responseData = await response.json()
    console.log("Test execution started:", responseData)
    
  } catch (error) {
    console.error('Error running tests:', error)
  } finally {
    isRunning.value = false
  }
}
</script>

<template>
  <Sheet v-model:open="isOpen">
    <!-- Trigger Button -->
    <SheetTrigger as-child>
      <Button 
        @click="openTestRunner"
        variant="default"
        size="sm"
        class="flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 border-0"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
        Run Test
      </Button>
    </SheetTrigger>

    <!-- Sheet Content -->
    <SheetContent 
      side="right" 
      class="flex flex-col p-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
    >
      <!-- Header -->
      <SheetHeader class="p-6 border-b bg-muted/20">
        <SheetTitle class="flex items-center gap-2 text-lg">
          <div class="p-2 bg-green-500/10 rounded-lg">
            <svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          Test Execution Dashboard
        </SheetTitle>
        <SheetDescription class="text-sm text-muted-foreground">
          Monitor your test execution in real-time with live streaming and console output
        </SheetDescription>
      </SheetHeader>

      <!-- Content -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Left Section - Video Stream (60%) -->
        <div class="flex-[3] border-r border-border">
          <div class="p-6 h-full flex flex-col">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold">Live Test Stream</h3>
              <Button @click="runTest" :disabled="isRunning" size="sm" variant="outline">
                <svg v-if="!isRunning" class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <svg v-else class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {{ isRunning ? 'Running...' : 'Start Test' }}
              </Button>
            </div>
            
            <div class="flex-1 bg-muted/30 rounded-lg overflow-hidden border">
              <img 
                src="http://localhost:3001/stream.mjpeg" 
                alt="Live Test Stream"
                class="w-full h-full object-contain"
                style="min-height: 400px;"
              />
            </div>
            
            <div class="mt-4 p-3 bg-muted/50 rounded-lg">
              <p class="text-sm text-muted-foreground">
                <strong>Stream URL:</strong> http://localhost:3001/stream.mjpeg
              </p>
            </div>
          </div>
        </div>

        <!-- Right Section - Console Output (40%) -->
        <div class="flex-[2]">
          <div class="p-6 h-full flex flex-col">
            <h3 class="text-lg font-semibold mb-4">Console Output</h3>
            
            <div class="flex-1 bg-black rounded-lg p-4 overflow-hidden">
              <div 
                id="logsContainer"
                class="h-full overflow-y-auto text-green-400 font-mono text-sm space-y-1"
              >
                <div class="text-gray-500">$ playwright test</div>
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
            
            <div class="mt-4 flex gap-2">
              <Button variant="outline" size="sm" class="flex-1">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Clear Logs
              </Button>
              <Button variant="outline" size="sm" class="flex-1">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Logs
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 border-t bg-muted/20">
        <div class="flex justify-between items-center">
          <div class="text-sm text-muted-foreground">
            Test execution powered by Playwright in Docker container
          </div>
          <Button @click="closeTestRunner" variant="outline">
            Close
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
