<script setup>
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'

const githubUser = ref(null)
const isGithubAuthenticated = ref(false)
const selectedRepository = ref(null)

onMounted(() => {
  checkGitHubAuth()
  checkRepositorySelection()
})

// Function to check GitHub authentication status
function checkGitHubAuth() {
  chrome.storage.local.get(['githubToken', 'githubUserId'], async (result) => {
    if (result.githubToken && result.githubUserId) {
      isGithubAuthenticated.value = true
      await verifyGitHubToken(result.githubToken)
    }
  })
}

// Function to check repository selection status
function checkRepositorySelection() {
  chrome.storage.local.get(['selectedRepository'], (result) => {
    if (result.selectedRepository) {
      selectedRepository.value = result.selectedRepository
    }
  })
}

async function verifyGitHubToken(token) {
  try {
    const response = await fetch('http://localhost:3000/api/auth/github/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })
    
    const result = await response.json()
    
    if (result.success) {
      githubUser.value = result.user
      isGithubAuthenticated.value = true
    } else {
      console.error('Token verification failed:', result.error)
      chrome.storage.local.remove(['githubToken'])
      isGithubAuthenticated.value = false
    }
  } catch (error) {
    console.error('Error verifying GitHub token:', error)
    isGithubAuthenticated.value = false
  }
}

function handleGitHubAuth() {
  console.log('Opening GitHub auth popup...')
  const popup = window.open(
    'http://localhost:3000/api/auth/github',
    'github_auth',
    'width=600,height=700,scrollbars=yes,resizable=yes'
  )
  
  const messageListener = (event) => {
    if (event.origin !== 'http://localhost:3000') return
    
    if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
      const { token, user } = event.data.data
      
      chrome.storage.local.set({ githubToken: token, githubUserId: user.id }, () => {
        githubUser.value = user
        isGithubAuthenticated.value = true
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
</script>

<template>
  <div class="flex items-center">
    <!-- GitHub Profile Display -->
    <div v-if="isGithubAuthenticated && githubUser" class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
      <img :src="githubUser.avatar_url" alt="GitHub Avatar" class="w-6 h-6 rounded-full">
      <div class="flex flex-col min-w-0">
        <span class="text-xs font-medium text-green-700 dark:text-green-300 truncate">
          {{ githubUser.name || githubUser.login }}
        </span>
        <span v-if="selectedRepository" class="text-xs text-green-600 dark:text-green-400 truncate">
          {{ selectedRepository.name }}
        </span>
      </div>
      <Icon icon="radix-icons:check-circled" class="w-4 h-4 text-green-600 flex-shrink-0" />
    </div>
    
    <!-- GitHub Connect Button -->
    <button
      v-else
      @click="handleGitHubAuth"
      class="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <Icon icon="radix-icons:github-logo" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
      <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Connect GitHub</span>
    </button>
  </div>
</template>