<script setup>
import { ref, defineProps, onUnmounted, nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const props = defineProps({
  editorInstance: Object
})

const isOpen = ref(false)
const isRunning = ref(false)
const logs = ref([])
const streamStatus = ref('disconnected')
let eventSource = null

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

function connectToLogs() {
  if (eventSource) {
    eventSource.close()
  }

  // Connect to the NestJS proxy endpoint for logs
  eventSource = new EventSource('http://localhost:3000/api/logs')
  
  eventSource.onopen = function() {
    addLogEntry('Connected to server logs', 'info')
    streamStatus.value = 'connected'
  }

  eventSource.onmessage = function(event) {
    try {
      const logData = JSON.parse(event.data)
      addLogEntry(logData.message, logData.level, logData.timestamp)
    } catch (error) {
      console.error('Error parsing log data:', error)
      addLogEntry('Error parsing log data', 'error')
    }
  }

  eventSource.onerror = function() {
    addLogEntry('Log connection error. Retrying...', 'error')
    streamStatus.value = 'error'
    setTimeout(() => {
      if (eventSource && eventSource.readyState === EventSource.CLOSED) {
        connectToLogs()
      }
    }, 5000)
  }
}

function addLogEntry(message, level = 'info', timestamp = null) {
  const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()
  logs.value.push({ time, level, message })
  
  // Keep only last 100 log entries
  if (logs.value.length > 100) {
    logs.value.shift()
  }

  // Auto-scroll to bottom - need to use nextTick for DOM update
  nextTick(() => {
    const logsContainer = document.getElementById('logsContainer')
    if (logsContainer) {
      logsContainer.scrollTop = logsContainer.scrollHeight
    }
  })
}

function clearLogs() {
  logs.value = []
  addLogEntry('Logs cleared', 'info')
}

function downloadLogs() {
  const logText = logs.value.map(log => `[${log.time}] ${log.level.toUpperCase()}: ${log.message}`).join('\n')
  const blob = new Blob([logText], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `playwright-logs-${new Date().toISOString().split('T')[0]}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Connect to logs when sheet opens, disconnect when closes
function handleSheetOpenChange(open) {
  isOpen.value = open
  if (open) {
    connectToLogs()
  } else {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    streamStatus.value = 'disconnected'
  }
}

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
  }
})
</script>

<template>
  <Sheet :open="isOpen" @update:open="handleSheetOpenChange">
    <!-- Trigger Button -->
    <SheetTrigger as-child>
      <Button 
        @click="() => handleSheetOpenChange(true)"
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

    <!-- Sheet Content with full width -->
    <SheetContent 
      side="right" 
      class="!w-[95vw] !max-w-none flex flex-col p-0"
      style="width: 95vw !important; max-width: none !important;"
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
          <span :class="[
            'px-2 py-1 text-xs rounded-full',
            streamStatus === 'connected' ? 'bg-green-100 text-green-800' : 
            streamStatus === 'error' ? 'bg-red-100 text-red-800' : 
            'bg-gray-100 text-gray-800'
          ]">
            {{ streamStatus }}
          </span>
        </SheetTitle>
        <SheetDescription class="text-sm text-muted-foreground">
          Monitor your test execution in real-time with live streaming and console output
        </SheetDescription>
      </SheetHeader>

      <!-- Content -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Left Section - Video Stream (65%) -->
        <div class="w-[65%] border-r border-border">
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
                style="min-height: 500px;"
              />
            </div>
            
            <div class="mt-4 p-3 bg-muted/50 rounded-lg">
              <p class="text-sm text-muted-foreground">
                <strong>Stream URL:</strong> http://localhost:3001/stream.mjpeg
              </p>
            </div>
          </div>
        </div>

        <!-- Right Section - Console Output (35%) -->
        <div class="w-[35%]">
          <div class="p-6 h-full flex flex-col">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold">Console Output</h3>
              <span class="text-sm text-muted-foreground">{{ logs.length }} logs</span>
            </div>
            
            <div class="flex-1 bg-black rounded-lg p-4 overflow-hidden">
              <div 
                id="logsContainer"
                class="h-full overflow-y-auto text-green-400 font-mono text-sm space-y-1"
              >
                <div v-for="(log, index) in logs" :key="index" class="log-entry">
                  <span class="text-gray-500 text-xs">[{{ log.time }}]</span>
                  <span :class="{
                    'text-white': log.level === 'info',
                    'text-red-400': log.level === 'error',
                    'text-yellow-400': log.level === 'warn',
                    'text-blue-400': log.level === 'debug',
                    'text-green-400': log.level === 'success'
                  }"> {{ log.message }}</span>
                </div>
                <div v-if="logs.length === 0" class="text-gray-500 text-center py-8">
                  <div>Connecting to log stream...</div>
                  <div class="animate-pulse mt-2">▊</div>
                </div>
              </div>
            </div>
            
            <div class="mt-4 flex gap-2">
              <Button @click="clearLogs" variant="outline" size="sm" class="flex-1">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                </svg>
                Clear
              </Button>
              <Button @click="downloadLogs" variant="outline" size="sm" class="flex-1">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
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
          <Button @click="() => handleSheetOpenChange(false)" variant="outline">
            Close
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
/* Force override shadcn sheet width constraints */
:deep([data-radix-dialog-content]) {
  width: 95vw !important;
  max-width: none !important;
}

:deep(.sheet-content) {
  width: 95vw !important;
  max-width: none !important;
}

.log-entry {
  margin-bottom: 4px;
  word-wrap: break-word;
  line-height: 1.4;
}
</style>
