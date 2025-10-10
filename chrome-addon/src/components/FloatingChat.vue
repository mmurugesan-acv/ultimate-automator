<script setup>
import { ref, nextTick, onMounted, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const isOpen = ref(false)
const isLoading = ref(false)
const message = ref('')
const messages = ref([])
const chatContainer = ref(null)

// Define props for framework and language
const props = defineProps({
  framework: {
    type: String,
    default: 'playwright'
  },
  language: {
    type: String, 
    default: 'javascript'
  }
})

// Computed system prompt based on selected framework and language
const systemPrompt = computed(() => {
  const frameworkNames = {
    playwrite: 'Playwright',
    cypress: 'Cypress',
    selenium: 'Selenium',
    puppeteer: 'Puppeteer'
  }
  
  const languageNames = {
    javascript: 'JavaScript',
    python: 'Python',
    java: 'Java',
    c_sharp: 'C#'
  }

  const frameworkName = frameworkNames[props.framework] || 'Playwright'
  const languageName = languageNames[props.language] || 'JavaScript'

  return `You are an AI assistant specialized in test automation and web development. You are currently helping a user who is working with ${frameworkName} in ${languageName}. 

You help users with ${frameworkName}, Cypress, Selenium, Playwright, and other testing frameworks. You can analyze captured user events, suggest improvements to test code, provide guidance on best practices, and help with ${languageName} syntax.

Focus your responses on ${frameworkName} and ${languageName} when providing code examples or specific guidance. Be concise but helpful.`
})

// Add initial welcome message with context
onMounted(() => {
  const frameworkName = props.framework === 'playwrite' ? 'Playwright' : props.framework
  const languageName = props.language === 'c_sharp' ? 'C#' : props.language
  
  messages.value.push({
    id: Date.now(),
    type: 'assistant',
    content: `Hi! I'm your Ultimate Automator AI assistant. I can see you're working with ${frameworkName} and ${languageName}. I can help you with test automation, code generation, and answer questions about your captured events. How can I assist you today?`,
    timestamp: new Date()
  })
})

function toggleChat() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      scrollToBottom()
    })
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

function createUserMessage(content) {
  return {
    id: Date.now(),
    type: 'user',
    content,
    timestamp: new Date()
  }
}

function createAssistantMessage() {
  return {
    id: Date.now() + 1,
    type: 'assistant',
    content: '',
    timestamp: new Date(),
    isStreaming: true
  }
}

async function postChatCompletion(currentMessage) {
  return fetch('https://llm-gateway.internal.latest.acvauctions.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        {
          role: 'system',
          content: systemPrompt.value
        },
        {
          role: 'user',
          content: currentMessage
        }
      ],
      stream: true
    })
  })
}

function processChunk(chunk, assistantMessage) {
  const lines = chunk.split('\n')
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6)
    if (data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data)
      const content = parsed.choices?.[0]?.delta?.content
      if (content) {
        assistantMessage.content += content
        scrollToBottom()
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }
}

async function streamResponse(response, assistantMessage) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    processChunk(chunk, assistantMessage)
  }
}

async function sendMessage() {
  if (!message.value.trim() || isLoading.value) return

  const userMessage = createUserMessage(message.value)
  messages.value.push(userMessage)

  const currentMessage = message.value
  message.value = ''
  isLoading.value = true

  const assistantMessage = createAssistantMessage()
  messages.value.push(assistantMessage)

  scrollToBottom()

  try {
    const response = await postChatCompletion(currentMessage)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    await streamResponse(response, assistantMessage)
    assistantMessage.isStreaming = false
  } catch (error) {
    console.error('Chat error:', error)
    assistantMessage.content = 'Sorry, I encountered an error. Please try again.'
    assistantMessage.isStreaming = false
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

function handleKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

// Auto-resize textarea
function autoResize(event) {
  const textarea = event.target
  textarea.style.height = 'auto'
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
}

function clearChat() {
  messages.value = [{
    id: Date.now(),
    type: 'assistant',
    content: 'Chat cleared! How can I help you?',
    timestamp: new Date()
  }]
}

function formatTime(timestamp) {
  return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <!-- Floating Chat Button -->
  <div class="fixed bottom-6 right-6 z-50">
    <!-- Chat Window -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 scale-95 translate-y-4"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-4"
    >
      <Card v-if="isOpen" class="w-96 h-[500px] mb-4 shadow-2xl border-2 flex flex-col overflow-hidden p-0">
        <CardHeader class="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg flex-shrink-0">
          <div class="flex items-center justify-between pt-">
            <CardTitle class="text-lg flex items-center gap-2">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              AI Assistant
            </CardTitle>
            <div class="flex items-center gap-2">
              <Button @click="clearChat" variant="ghost" size="sm" class="text-white hover:text-white hover:bg-white/20">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </Button>
              <Button @click="toggleChat" variant="ghost" size="sm" class="text-white hover:text-white hover:bg-white/20">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent class="flex-1 flex flex-col p-0 min-h-0">
          <!-- Messages Area -->
          <div 
            ref="chatContainer"
            class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            style="scrollbar-width: thin; scrollbar-color: rgba(156, 163, 175, 0.5) transparent;"
          >
            <div 
              v-for="msg in messages" 
              :key="msg.id"
              :class="[
                'flex',
                msg.type === 'user' ? 'justify-end' : 'justify-start'
              ]"
            >
              <div 
                :class="[
                  'max-w-[80%] p-3 rounded-lg text-sm break-words',
                  msg.type === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-muted text-foreground rounded-bl-none'
                ]"
              >
                <div class="whitespace-pre-wrap leading-relaxed">{{ msg.content }}</div>
                <div v-if="msg.isStreaming" class="animate-pulse inline-block ml-1">▊</div>
                <div 
                  :class="[
                    'text-xs mt-2 opacity-70',
                    msg.type === 'user' ? 'text-blue-100' : 'text-muted-foreground'
                  ]"
                >
                  {{ formatTime(msg.timestamp) }}
                </div>
              </div>
            </div>

            <!-- Loading indicator -->
            <div v-if="isLoading && !messages[messages.length - 1]?.isStreaming" class="flex justify-start">
              <div class="bg-muted p-3 rounded-lg rounded-bl-none">
                <div class="flex items-center gap-2">
                  <div class="flex space-x-1">
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                  </div>
                  <span class="text-xs text-muted-foreground">AI is thinking...</span>
                </div>
              </div>
            </div>
          </div>

          <Separator class="flex-shrink-0" />

          <!-- Input Area -->
          <div class="p-4 flex-shrink-0">
            <div class="flex gap-2 items-end">
              <Textarea
                v-model="message"
                @keypress="handleKeyPress"
                @input="autoResize"
                placeholder="Ask about test automation, code generation..."
                class="flex-1 min-h-[40px] max-h-[120px] resize-none"
                :disabled="isLoading"
                rows="1"
              />
              <Button 
                @click="sendMessage" 
                :disabled="!message.trim() || isLoading"
                class="px-3 py-2 flex-shrink-0"
                size="sm"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </Button>
            </div>
            <div class="text-xs text-muted-foreground mt-2">
              Press Enter to send • Shift+Enter for new line
            </div>
          </div>
        </CardContent>
      </Card>
    </Transition>

    <!-- Chat Toggle Button -->
    <Button 
      @click="toggleChat"
      class="w-14 h-14 rounded-full shadow-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-0 transition-all duration-200 hover:scale-110"
    >
      <svg v-if="!isOpen" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
      <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7-7m0 0l-7 7m7-7v18"/>
      </svg>
    </Button>
  </div>
</template>

<style>
/* Custom scrollbar styling */
.scroll-smooth::-webkit-scrollbar {
  width: 6px;
}

.scroll-smooth::-webkit-scrollbar-track {
  background: transparent;
}

.scroll-smooth::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

.scroll-smooth::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.7);
}
</style>
