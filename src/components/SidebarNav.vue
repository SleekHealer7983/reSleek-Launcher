<script setup lang="ts">
import type { PageId } from "../types";

defineProps<{
  active: PageId;
}>();

const emit = defineEmits<{
  navigate: [page: PageId];
}>();

const items: { id: PageId; label: string; icon: string }[] = [
  { id: "desktop", label: "桌面", icon: "space_dashboard" },
  { id: "settings", label: "设置", icon: "settings" },
];
</script>

<template>
  <nav class="dock" aria-label="主导航">
    <button
      v-for="item in items"
      :key="item.id"
      class="dock-item"
      :class="{ active: active === item.id }"
      type="button"
      :aria-current="active === item.id ? 'page' : undefined"
      @click="emit('navigate', item.id)"
    >
      <span class="dock-indicator">
        <span class="material-symbols-rounded" aria-hidden="true">
          {{ item.icon }}
        </span>
      </span>
      <span class="dock-label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.dock {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  align-self: flex-start;
}

.dock-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 84px;
  padding: 4px 6px 0;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color 200ms ease,
    background 200ms ease;
}

.dock-indicator {
  display: grid;
  place-items: center;
  width: 62px;
  height: 32px;
  border-radius: 999px;
  background: transparent;
  transition:
    background 240ms cubic-bezier(0.16, 1, 0.3, 1),
    color 200ms ease;
}

.dock-indicator .material-symbols-rounded {
  font-size: 23px;
  font-variation-settings:
    "FILL" 0,
    "wght" 450,
    "GRAD" 0,
    "opsz" 24;
}

.dock-label {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.dock-item:hover {
  color: var(--text-primary);
}

.dock-item:hover .dock-indicator {
  background: color-mix(in srgb, var(--surface-hover) 70%, transparent);
}

.dock-item:active .dock-indicator {
  transform: scale(0.96);
}

.dock-item.active {
  color: var(--text-primary);
}

.dock-item.active .dock-indicator {
  color: var(--on-accent-container);
  background: var(--accent-container);
}

.dock-item.active .dock-indicator .material-symbols-rounded {
  font-variation-settings:
    "FILL" 1,
    "wght" 450,
    "GRAD" 0,
    "opsz" 24;
}

.dock-item:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
