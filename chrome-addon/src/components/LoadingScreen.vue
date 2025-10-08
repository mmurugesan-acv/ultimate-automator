<template>
  <!-- Loading Screen Overlay -->
  <div v-show="isVisible" class="fixed inset-0 flex items-center justify-center z-50"
    style="background: rgba(0, 0, 0, 0.01); backdrop-filter: blur(2px);">
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
</template>

<script setup>
defineProps({
  isVisible: {
    type: Boolean,
    default: false
  }
})
</script>

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