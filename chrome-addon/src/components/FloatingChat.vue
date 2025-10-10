<script setup>
import { ref, nextTick, onMounted, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

const isOpen = ref(false)
const isLoading = ref(false)
const message = ref('')
const messages = ref([])
const chatContainer = ref(null)
const contentQueue = ref('') // Queue for pending content
const isTyping = ref(false)   // Flag to prevent concurrent typing
const shouldStop = ref(false) // Flag to stop streaming

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

// Simplified typewriter effect that processes queued content
async function processQueuedContent(assistantMessage) {
  if (isTyping.value || shouldStop.value) return // Prevent concurrent execution or if stopped
  
  isTyping.value = true
  
  while (contentQueue.value.length > 0 && !shouldStop.value) {
    const char = contentQueue.value[0]
    contentQueue.value = contentQueue.value.slice(1)
    
    assistantMessage.content += char
    
    // Force Vue reactivity update
    messages.value = [...messages.value]
    scrollToBottom()
    
    // Variable delay based on character type for more realistic typing
    let delay = 15 // Reduced base delay for smoother experience
    
    if (char === ' ') delay = 25
    else if (char === '\n') delay = 50
    else if (/[.!?]/.test(char)) delay = 100
    else if (/[,;:]/.test(char)) delay = 40
    else if (char === '`') delay = 30
    
    // Smaller random variation
    delay += Math.random() * 10
    
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  
  isTyping.value = false
}

function processChunk(chunk, assistantMessage) {
  if (shouldStop.value) return // Stop processing if stop requested
  
  const lines = chunk.split('\n')
  for (const line of lines) {
    if (!line.startsWith('data: ') || shouldStop.value) continue
    const data = line.slice(6)
    if (data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data)
      const content = parsed.choices?.[0]?.delta?.content
      if (content && !shouldStop.value) {
        // Add content to queue instead of processing immediately
        contentQueue.value += content
        // Process queued content
        processQueuedContent(assistantMessage)
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }
}

async function streamResponse(response, assistantMessage) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  
  // Reset queue and typing state
  contentQueue.value = ''
  isTyping.value = false
  shouldStop.value = false
  
  try {
    while (true && !shouldStop.value) {
      const { done, value } = await reader.read()
      if (done || shouldStop.value) break
      
      const chunk = decoder.decode(value, { stream: true })
      processChunk(chunk, assistantMessage)
    }
    
    // If stopped, clear the queue and finish immediately
    if (shouldStop.value) {
      contentQueue.value = ''
      isTyping.value = false
      assistantMessage.isStreaming = false
      messages.value = [...messages.value]
      return
    }
    
    // Wait for any remaining queued content to finish
    while (contentQueue.value.length > 0 || isTyping.value) {
      if (shouldStop.value) break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
  } catch (error) {
    console.error('Streaming error:', error)
  }
}

function stopStreaming() {
  shouldStop.value = true
  contentQueue.value = ''
  isTyping.value = false
  
  // Mark the last message as stopped
  const lastMessage = messages.value[messages.value.length - 1]
  if (lastMessage && lastMessage.isStreaming) {
    lastMessage.isStreaming = false
    lastMessage.content += ' [Message stopped]'
    messages.value = [...messages.value]
  }
  
  isLoading.value = false
  scrollToBottom()
}

async function sendMessage() {
  if (!message.value.trim() || isLoading.value) return

  const userMessage = createUserMessage(message.value)
  messages.value.push(userMessage)

  const currentMessage = message.value
  message.value = ''
  isLoading.value = true
  shouldStop.value = false // Reset stop flag

  const assistantMessage = createAssistantMessage()
  messages.value.push(assistantMessage)

  scrollToBottom()

  try {
    const response = await postChatCompletion(currentMessage)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    await streamResponse(response, assistantMessage)
    
    if (!shouldStop.value) {
      assistantMessage.isStreaming = false
      // Final update to ensure clean state
      messages.value = [...messages.value]
    }
  } catch (error) {
    console.error('Chat error:', error)
    assistantMessage.content = 'Sorry, I encountered an error. Please try again.'
    assistantMessage.isStreaming = false
    messages.value = [...messages.value]
  } finally {
    if (!shouldStop.value) {
      isLoading.value = false
    }
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
      <Card v-if="isOpen" class="w-[480px] h-[600px] mb-4 shadow-2xl border flex flex-col overflow-hidden !pt-0">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b bg-muted/30">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 text-lg font-semibold">
              <svg class="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              CHAT
            </div>
            <Badge variant="secondary" class="text-xs px-2 py-1">
              {{ framework }} • {{ language }}
            </Badge>
          </div>
          
          <div class="flex items-center gap-1">
            <!-- Action buttons -->
            <Button @click="clearChat" variant="ghost" size="sm" class="h-8 w-8 p-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
            </Button>
            
            <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </Button>
            
            <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </Button>
            
            <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"/>
              </svg>
            </Button>
            
            <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l4 4m8-4v4m0-4h-4m4 0l-4 4M4 16v4m0 0h4m-4 0l4-4m8 4l-4-4m4 4v-4m0 4h-4"/>
              </svg>
            </Button>
            
            <Button @click="toggleChat" variant="ghost" size="sm" class="h-8 w-8 p-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </Button>
          </div>
        </div>

        <!-- Messages Area -->
        <CardContent class="flex-1 p-0 min-h-0">
          <ScrollArea class="h-full" ref="chatContainer">
            <div class="p-4 space-y-6">
              <div 
                v-for="msg in messages" 
                :key="msg.id"
                class="flex flex-col gap-2"
              >
                <!-- User Message -->
                <div v-if="msg.type === 'user'" class="flex justify-end">
                  <div class="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3 shadow-sm">
                    <div class="text-sm leading-relaxed whitespace-pre-wrap">{{ msg.content }}</div>
                  </div>
                </div>
                
                <!-- Assistant Message with enhanced streaming effect -->
                <div v-else class="flex justify-start">
                  <div class="max-w-[85%] bg-muted rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <div class="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                      <span class="streaming-text">{{ msg.content }}</span>
                      <span v-if="msg.isStreaming" class="animate-pulse ml-1 text-primary typing-cursor">▊</span>
                    </div>
                    
                    <!-- Language badge for code responses -->
                    <div v-if="msg.content.includes('```') || msg.content.includes('server.js')" class="mt-2">
                      <Badge variant="outline" class="text-xs">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        {{ language }}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <!-- Timestamp -->
                <div class="text-xs text-muted-foreground px-4" :class="msg.type === 'user' ? 'text-right' : 'text-left'">
                  {{ formatTime(msg.timestamp) }}
                </div>
              </div>

              <!-- Loading indicator -->
              <div v-if="isLoading && !messages[messages.length - 1]?.isStreaming" class="flex justify-start">
                <div class="bg-muted rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div class="flex items-center gap-2">
                    <div class="flex space-x-1">
                      <div class="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"></div>
                      <div class="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                      <div class="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                    </div>
                    <span class="text-xs text-muted-foreground">AI is thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>

        <!-- Input Area -->
        <div class="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div class="p-4">
            <div class="flex gap-2 items-end">
              <div class="flex-1 relative">
                <Textarea
                  v-model="message"
                  @keypress="handleKeyPress"
                  @input="autoResize"
                  placeholder="Ask about test automation, code generation..."
                  class="min-h-[44px] max-h-[120px] resize-none border-0 shadow-none focus-visible:ring-1 bg-muted/50 rounded-xl px-4 py-3 pr-12"
                  :disabled="isLoading"
                  rows="1"
                />
                
                <!-- Send/Stop button inside textarea -->
                <Button 
                  v-if="!isLoading"
                  @click="sendMessage" 
                  :disabled="!message.trim()"
                  size="sm"
                  class="absolute right-2 bottom-2 h-8 w-8 p-0 rounded-lg"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-7-7l7 7-7 7"/>
                  </svg>
                </Button>
                
                <!-- Stop button when streaming -->
                <Button 
                  v-else
                  @click="stopStreaming"
                  size="sm"
                  variant="destructive"
                  class="absolute right-2 bottom-2 h-8 w-8 p-0 rounded-lg"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h12v12H6z"/>
                  </svg>
                </Button>
              </div>
            </div>
            
            <div class="flex items-center justify-between mt-2 px-1">
              <div class="text-xs text-muted-foreground">
                <span v-if="!isLoading">Press Enter to send • Shift+Enter for new line</span>
                <span v-else class="text-destructive">Click stop to interrupt • Streaming in progress</span>
              </div>
              <div class="text-xs text-muted-foreground">
                {{ message.length }}/2000
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Transition>

    <!-- Chat Toggle Button -->
    <Button 
      @click="toggleChat"
      class="w-14 h-14 rounded-full shadow-lg border-0 bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105"
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
/* Custom scrollbar styling for ScrollArea */
.scroll-smooth::-webkit-scrollbar {
  width: 4px;
}

.scroll-smooth::-webkit-scrollbar-track {
  background: transparent;
}

.scroll-smooth::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 2px;
}

.scroll-smooth::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}

/* Enhanced typing cursor animation */
.typing-cursor {
  animation: typingCursor 1.2s infinite;
  font-weight: bold;
}

@keyframes typingCursor {
  0%, 50% { 
    opacity: 1; 
    transform: scale(1);
  }
  51%, 100% { 
    opacity: 0.3; 
    transform: scale(0.95);
  }
}

/* Streaming text animation */
.streaming-text {
  display: inline-block;
  position: relative;
}

/* Add a subtle glow effect while streaming */
.streaming-text::after {
  content: '';
  position: absolute;
  top: 0;
  right: -2px;
  width: 1px;
  height: 100%;
  background: hsl(var(--primary));
  opacity: 0.7;
  animation: streamGlow 2s ease-in-out infinite;
}

@keyframes streamGlow {
  0%, 100% { opacity: 0; }
  50% { opacity: 0.7; }
}
</style>
