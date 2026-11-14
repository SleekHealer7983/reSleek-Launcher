<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { dateLabel, holidayLabel } from "../lib/holidays";
import { settings } from "../settings";

defineProps<{ preview?: boolean }>();

const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | undefined;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

const timeMain = computed(
  () => `${pad2(now.value.getHours())}:${pad2(now.value.getMinutes())}`,
);
const seconds = computed(() => pad2(now.value.getSeconds()));
const milliseconds = computed(() =>
  String(now.value.getMilliseconds()).padStart(3, "0"),
);

const dateKey = computed(
  () =>
    `${now.value.getFullYear()}-${now.value.getMonth() + 1}-${now.value.getDate()}`,
);

const dateInfo = computed(() => {
  const [year, month, day] = dateKey.value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return {
    date: dateLabel(date),
    holiday: holidayLabel(date),
  };
});

const showSeconds = computed(() => settings.clockShowSeconds);
const showMilliseconds = computed(
  () => settings.clockShowSeconds && settings.clockShowMilliseconds,
);
const showDate = computed(() => settings.clockShowDate);
const showHoliday = computed(
  () => settings.clockShowHoliday && Boolean(dateInfo.value.holiday),
);
const hasMeta = computed(() => showDate.value || showHoliday.value);

function tick() {
  now.value = new Date();
}

function restartTimer() {
  if (timer) clearInterval(timer);
  timer = undefined;
  now.value = new Date();
  if (!settings.clockEnabled) return;

  const interval =
    settings.clockShowMilliseconds && settings.clockShowSeconds ? 31 : 1000;
  timer = setInterval(tick, interval);
}

watch(
  () => [
    settings.clockEnabled,
    settings.clockShowSeconds,
    settings.clockShowMilliseconds,
  ],
  () => restartTimer(),
  { immediate: true },
);

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div
    v-if="settings.clockEnabled"
    class="clock-display"
    :class="{ preview, 'no-background': !settings.clockBackground }"
    role="group"
    aria-label="时间显示"
  >
    <div class="clock-time">
      <span>{{ timeMain }}</span>
      <span v-if="showSeconds" class="clock-seconds">:{{ seconds }}</span>
      <span v-if="showMilliseconds" class="clock-ms">.{{ milliseconds }}</span>
    </div>

    <div v-if="hasMeta" class="clock-meta">
      <span v-if="showDate">{{ dateInfo.date }}</span>
      <span v-if="showHoliday" class="clock-holiday">{{ dateInfo.holiday }}</span>
    </div>
  </div>
</template>

<style scoped>
.clock-display {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  flex-shrink: 0;
  margin-left: auto;
  padding: 5px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-card) 58%, transparent);
  box-shadow: 0 2px 10px rgba(35, 24, 48, 0.04);
  backdrop-filter: blur(14px);
  user-select: none;
}

.clock-time {
  display: flex;
  align-items: baseline;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 720;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
  line-height: 1.1;
}

.clock-ms {
  margin-left: 1px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
}

.clock-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
  white-space: nowrap;
}

.clock-holiday {
  color: var(--accent);
  font-weight: 680;
}

.clock-display.preview {
  align-items: flex-start;
  margin-left: 0;
  padding: 16px 20px;
  border-radius: 22px;
  background: var(--surface-inner);
  box-shadow: none;
  backdrop-filter: none;
}

.clock-display.preview .clock-time {
  font-size: 38px;
  letter-spacing: -1.2px;
}

.clock-display.preview .clock-ms {
  font-size: 15px;
}

.clock-display.preview .clock-meta {
  font-size: 12px;
}

.clock-display.no-background,
.clock-display.no-background.preview {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}
</style>
