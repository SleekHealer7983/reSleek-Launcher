<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import SplashScreen from "./components/SplashScreen.vue";
import BrandHeader from "./components/BrandHeader.vue";
import SidebarNav from "./components/SidebarNav.vue";
import DesktopView from "./views/DesktopView.vue";
import SettingsView from "./views/SettingsView.vue";
import type { PageId } from "./types";
import { isDesktop } from "./services/backend";
import { settings } from "./settings";

const splashFinished = ref(false);
const activePage = ref<PageId>("desktop");

const pageTitles: Record<PageId, string> = {
  desktop: "桌面",
  settings: "设置",
};

async function toggleFullscreen() {
  settings.fullscreen = !settings.fullscreen;
  if (!isDesktop) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setFullscreen(settings.fullscreen);
  } catch (error) {
    console.error(error);
  }
}

async function exitLauncher() {
  if (!isDesktop) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch (error) {
    console.error(error);
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "F11" || !isDesktop) return;
  event.preventDefault();
  void toggleFullscreen();
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  if (!isDesktop) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setFullscreen(settings.fullscreen);
  } catch (error) {
    console.error(error);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <SplashScreen
    v-if="!splashFinished"
    @finished="splashFinished = true"
  />

  <main v-else class="launcher">
    <div
      v-if="settings.backgroundImage"
      class="custom-background"
      :style="{
        backgroundImage: `url(${settings.backgroundImage})`,
        filter: `blur(${settings.backgroundBlur}px)`,
      }"
    ></div>
    <div
      v-if="settings.backgroundImage"
      class="custom-background-scrim"
    ></div>

    <div class="launcher-stage">
      <BrandHeader :title="pageTitles[activePage]" />

      <div class="launcher-content">
        <Transition name="page" mode="out-in">
          <DesktopView v-if="activePage === 'desktop'" key="desktop" />
          <SettingsView v-else key="settings" />
        </Transition>
      </div>

      <div class="launcher-footer">
        <SidebarNav
          :active="activePage"
          @navigate="activePage = $event"
        />

        <button
          class="exit-button"
          type="button"
          title="退出 reSleek Launcher"
          aria-label="退出 reSleek Launcher"
          @click="exitLauncher"
        >
          <span class="material-symbols-rounded" aria-hidden="true">power_settings_new</span>
          <span>退出</span>
        </button>
      </div>
    </div>
  </main>
</template>

<style>
.launcher {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(
      70% 55% at 50% 0%,
      color-mix(in srgb, var(--accent-container) 62%, transparent),
      transparent 62%
    ),
    var(--page-background);
}

.launcher-stage {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1680px;
  height: 100%;
  margin: 0 auto;
  padding: clamp(20px, 2.6vw, 32px) clamp(24px, 3.2vw, 42px)
    clamp(16px, 2.2vw, 26px);
  transform-origin: 50% 48%;
  animation: stage-enter 780ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.custom-background {
  position: fixed;
  inset: -60px;
  z-index: 0;
  background-position: center;
  background-size: cover;
  pointer-events: none;
  transition: filter 120ms linear;
}

.custom-background-scrim {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: linear-gradient(
    color-mix(in srgb, var(--page-background) 58%, transparent),
    color-mix(in srgb, var(--page-background) 30%, transparent)
  );
  pointer-events: none;
}

.launcher-content {
  flex: 1;
  min-height: 0;
  padding: 18px 0 20px;
}

.launcher-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}

.exit-button {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-card);
  color: var(--text-secondary);
  box-shadow: var(--shadow-card);
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
  transition:
    background 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.exit-button:hover {
  background: var(--surface-hover);
  color: var(--mtrl-sys-color-error, #b3261e);
}

.exit-button:active {
  transform: scale(0.97);
}

.exit-button .material-symbols-rounded {
  font-size: 18px;
}

.page-enter-active {
  transition:
    opacity 260ms cubic-bezier(0.2, 0, 0, 1),
    transform 340ms cubic-bezier(0.16, 1, 0.3, 1);
}

.page-leave-active {
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
}

.page-leave-to {
  opacity: 0;
  transform: scale(0.992);
}

@keyframes stage-enter {
  from {
    opacity: 0;
    transform: scale(0.9);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (max-width: 720px) {
  .launcher-stage {
    padding-inline: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .launcher-stage {
    animation-duration: 1ms;
  }

  .page-enter-active,
  .page-leave-active {
    transition-duration: 1ms;
  }
}
</style>
