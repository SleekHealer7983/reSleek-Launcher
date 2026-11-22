<script setup lang="ts">
import { computed } from "vue";
import ClockDisplay from "./ClockDisplay.vue";
import { settings } from "../settings";

defineProps<{
  title: string;
}>();

const logoSrc = computed(() =>
  settings.dark
    ? "/assets/reSleekLogoDark.png"
    : "/assets/reSleekLogoLight.png",
);
</script>

<template>
  <header class="brand-header">
    <img
      class="brand-mark"
      :src="logoSrc"
      alt="reSleek"
    />

    <span class="brand-divider" aria-hidden="true"></span>

    <h1 class="brand-title mtrl-display-small">{{ title }}</h1>

    <ClockDisplay class="brand-clock" />
  </header>
</template>

<style scoped>
.brand-header {
  display: flex;
  align-items: center;
  gap: 20px;
  min-height: 56px;
}

.brand-clock {
  margin-left: auto;
}

.brand-mark {
  display: block;
  width: auto;
  height: 34px;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.brand-divider {
  width: 1px;
  height: 32px;
  flex-shrink: 0;
  background: var(--border-subtle);
}

.brand-title {
  margin: 0;
  color: var(--text-primary);
  letter-spacing: 0;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .brand-mark {
    height: 26px;
  }

  .brand-divider {
    height: 26px;
  }

  .brand-header {
    gap: 14px;
  }
}
</style>
