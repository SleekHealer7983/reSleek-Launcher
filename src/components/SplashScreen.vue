<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { MLoadingIndicator } from "material/vue";
import { settings } from "../settings";

const emit = defineEmits<{
  finished: [];
}>();

const exiting = ref(false);

let exitTimer: ReturnType<typeof setTimeout> | undefined;
let finishTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  exitTimer = setTimeout(() => {
    exiting.value = true;

    finishTimer = setTimeout(() => {
      emit("finished");
    }, 620);
  }, 3000);
});

onUnmounted(() => {
  if (exitTimer) clearTimeout(exitTimer);
  if (finishTimer) clearTimeout(finishTimer);
});
</script>

<template>
  <main class="splash-screen" :class="{ exiting }">
    <div class="splash-content">
      <img
        class="splash-logo"
        :src="
          settings.dark
            ? '/assets/reSleekLauncherLogoLight.png'
            : '/assets/reSleekLauncherLogoDark.png'
        "
        alt="reSleek Launcher"
      />

      <div class="splash-loading">
        <MLoadingIndicator
          :size="56"
          contained
          aria-label="正在加载"
        />
      </div>
    </div>
  </main>
</template>

<style scoped>
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(
      ellipse 58% 46% at 50% 44%,
      color-mix(in srgb, var(--accent-container) 88%, transparent) 0%,
      color-mix(in srgb, var(--accent-container) 42%, transparent) 52%,
      transparent 100%
    ),
    var(--page-background);
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.splash-logo {
  display: block;
  width: min(620px, 68vw);
  height: auto;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  animation: logo-arrive 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.splash-loading {
  display: flex;
  justify-content: center;
  margin-top: 34px;
  opacity: 0;
  animation: loading-arrive 500ms ease 420ms forwards;
}

.exiting .splash-content {
  animation: splash-exit 600ms cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes logo-arrive {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.97);
  }

  to {
    opacity: 1;
    transform: translateY(-10px) scale(1);
  }
}

@keyframes loading-arrive {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes splash-exit {
  to {
    opacity: 0;
    transform: translateY(-26px) scale(0.97);
  }
}

@media (max-width: 720px) {
  .splash-logo {
    width: min(420px, 78vw);
  }
}

@media (prefers-reduced-motion: reduce) {
  .splash-logo,
  .splash-loading,
  .exiting .splash-content {
    animation-duration: 1ms;
  }
}
</style>
