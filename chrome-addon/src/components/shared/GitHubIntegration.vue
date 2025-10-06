<script setup>
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'

const githubUser = ref(null)
const isGithubAuthenticated = ref(false)
const githubRepositories = ref([])
const isLoadingRepos = ref(false)
const selectedRepository = ref(null)
const githubToken = ref(null)

onMounted(() => {
  chrome.storage.local.get(['githubToken'], async (result) => {
    if (result.githubToken) {
      await verifyGitHubToken(result.githubToken)
    }
  })
})

async function verifyGitHubToken(token) {
  try {
    console.log('Verifying GitHub token...')
    const response = await fetch('http://localhost:3000/api/auth/github/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })
    
    const result = await response.json()
    console.log('Token verification result:', result)
    
    if (result.success) {
      githubUser.value = result.user
      githubToken.value = token
      isGithubAuthenticated.value = true
      
      // Store token in backend
      await storeTokenInBackend(token, result.user.id.toString())
      
      // Load repositories
      await loadRepositories(token)
    } else {
      console.error('Token verification failed:', result.error)
      chrome.storage.local.remove(['githubToken'])
    }
  } catch (error) {
    console.error('Error verifying GitHub token:', error)
  }
}

async function storeTokenInBackend(token, userId) {
  try {
    await fetch('http://localhost:3000/api/auth/github/store-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, userId }),
    })
  } catch (error) {
    console.error('Error storing token in backend:', error)
  }
}

async function loadRepositories(token) {
  console.log('Loading repositories...')
  isLoadingRepos.value = true
  try {
    const response = await fetch('http://localhost:3000/api/auth/github/repositories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })
    
    console.log('Repository response status:', response.status)
    const result = await response.json()
    console.log('Repository result:', result)
    
    if (result.success) {
      githubRepositories.value = result.repositories
      console.log('Loaded repositories count:', result.repositories.length)
    } else {
      console.error('Failed to load repositories:', result.error)
    }
  } catch (error) {
    console.error('Error loading repositories:', error)
  } finally {
    isLoadingRepos.value = false
  }
}

function handleGitHubAuth() {
  if (isGithubAuthenticated.value) {
    console.log('Already authenticated')
    return
  }
  
  console.log('Opening GitHub auth popup...')
  const popup = window.open(
    'http://localhost:3000/api/auth/github',
    'github_auth',
    'width=600,height=700,scrollbars=yes,resizable=yes'
  )
  
  const messageListener = (event) => {
    if (event.origin !== 'http://localhost:3000') return
    
    console.log('Received message from popup:', event.data)
    
    if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
      const { token, user } = event.data.data
      
      chrome.storage.local.set({ githubToken: token }, async () => {
        githubUser.value = user
        githubToken.value = token
        isGithubAuthenticated.value = true
        
        await storeTokenInBackend(token, user.id.toString())
        await loadRepositories(token)
        
        console.log('GitHub authentication successful')
      })
      
      window.removeEventListener('message', messageListener)
    } else if (event.data.type === 'GITHUB_AUTH_ERROR') {
      console.error('GitHub auth error:', event.data.error)
      window.removeEventListener('message', messageListener)
    }
  }
  
  window.addEventListener('message', messageListener)
  
  const checkClosed = setInterval(() => {
    if (popup.closed) {
      window.removeEventListener('message', messageListener)
      clearInterval(checkClosed)
    }
  }, 1000)
}

function selectRepository(repo) {
  selectedRepository.value = repo
  console.log('Selected repository:', repo)
}
</script>

<template>
  <div class="w-full">
    <!-- GitHub Auth Button -->
    <div class="flex justify-center mb-4">
      <button
        @click="handleGitHubAuth"
        class="flex items-center gap-2 px-4 py-2 rounded-md border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        :class="{ 'border-green-500 bg-green-50 dark:bg-green-900/20': isGithubAuthenticated }"
      >
        <Icon 
          icon="radix-icons:github-logo" 
          class="w-4 h-4" 
          :class="{ 'text-green-600': isGithubAuthenticated }"
        />
        <span class="text-sm">
          {{ isGithubAuthenticated ? 'GitHub Connected' : 'Connect GitHub' }}
        </span>
      </button>
    </div>

    <!-- GitHub User Info -->
    <div v-if="isGithubAuthenticated && githubUser" class="w-full mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
      <div class="flex items-center gap-2">
        <img :src="githubUser.avatar_url" alt="Avatar" class="w-8 h-8 rounded-full">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ githubUser.name || githubUser.login }}</p>
          <p class="text-xs text-gray-500 truncate">Connected to GitHub</p>
        </div>
      </div>
    </div>

    <!-- Repositories List -->
    <div v-if="isGithubAuthenticated" class="w-full">
      <h3 class="text-sm font-medium mb-2">Select Repository:</h3>
      
      <div v-if="isLoadingRepos" class="text-center py-4">
        <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        <p class="text-xs text-gray-500 mt-2">Loading repositories...</p>
      </div>
      
      <div v-else-if="githubRepositories.length === 0" class="text-center py-4">
        <p class="text-xs text-gray-500">No repositories found</p>
        <button 
          @click="loadRepositories(githubToken)"
          class="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
        >
          Retry
        </button>
      </div>
      
      <div v-else class="max-h-32 overflow-y-auto border rounded-md">
        <div 
          v-for="repo in githubRepositories" 
          :key="repo.id"
          @click="selectRepository(repo)"
          class="p-2 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
          :class="{ 'bg-blue-50 dark:bg-blue-900/20': selectedRepository?.id === repo.id }"
        >
          <div class="flex items-center gap-2">
            <Icon 
              :icon="repo.private ? 'radix-icons:lock-closed' : 'radix-icons:github-logo'" 
              class="w-4 h-4 text-gray-500"
            />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium truncate">{{ repo.name }}</p>
              <p v-if="repo.description" class="text-xs text-gray-500 truncate">{{ repo.description }}</p>
            </div>
          </div>
        </div>
      </div>
      
      <p v-if="selectedRepository" class="text-xs text-green-600 mt-2">
        Selected: {{ selectedRepository.name }}
      </p>
    </div>
  </div>
</template>
