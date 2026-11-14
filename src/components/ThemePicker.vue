<script setup lang="ts">
import { computed, ref } from "vue";
import { MSwitch } from "material/vue";
import {
  DEFAULT_SEED,
  THEME_PRESETS,
  argbToHex,
  previewTheme,
  type ThemePreset,
} from "../theme";
import { settings, saveSettings } from "../settings";
import { createBackgroundDataUrl } from "../lib/background";
import { sourceColorFromImage } from "material/theme/image";

const colorInput = ref<HTMLInputElement | null>(null);
const wallpaperInput = ref<HTMLInputElement | null>(null);
const wallpaperBusy = ref(false);

const presets = computed(() =>
  THEME_PRESETS.map((preset: ThemePreset) => ({
    ...preset,
    preview: previewTheme(preset.seed),
  })),
);

const customPreview = computed(() => previewTheme(settings.seed));

function selectPreset(preset: ThemePreset) {
  settings.seed = preset.seed;
  settings.customColor = false;
}

function openCustomPicker() {
  colorInput.value?.click();
}

function onCustomInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (!value) return;
  settings.seed = value;
  settings.customColor = true;
}

function resetColor() {
  settings.seed = DEFAULT_SEED;
  settings.customColor = false;
}

async function onWallpaperSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  wallpaperBusy.value = true;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const hct = await sourceColorFromImage(image);
    settings.seed = argbToHex(hct.toInt());
    settings.customColor = true;

    try {
      settings.backgroundImage = await createBackgroundDataUrl(file);
      if (settings.backgroundBlur <= 0) settings.backgroundBlur = 12;
    } catch {
      // The theme can still update when the image cannot be used as a background.
    }

    saveSettings();
  } catch {
    // Unsupported image or a cancelled decode: keep the previous theme.
  } finally {
    URL.revokeObjectURL(url);
    wallpaperBusy.value = false;
  }
}

function removeWallpaper() {
  settings.backgroundImage = "";
  saveSettings();
}
</script>

<template>
  <div class="theme-panel">
    <p class="theme-note">
      图标、文字等元素会自动采用所选配色；选择一张壁纸会同时更新启动器背景和主题色。
    </p>

    <div class="swatches" role="radiogroup" aria-label="主题配色">
      <button
        class="swatch custom-swatch"
        :class="{ selected: settings.customColor }"
        type="button"
        role="radio"
        :aria-checked="settings.customColor"
        aria-label="自定义颜色"
        title="自定义颜色"
        @click="openCustomPicker"
      >
        <span
          v-if="settings.customColor"
          class="custom-color"
          :style="{ background: customPreview.lightPrimary }"
        ></span>
        <span class="material-symbols-rounded custom-icon">palette</span>
        <input
          ref="colorInput"
          class="color-input"
          type="color"
          :value="settings.seed"
          tabindex="-1"
          aria-hidden="true"
          @click.stop
          @input="onCustomInput"
          @change="onCustomInput"
        />
      </button>

      <button
        v-for="preset in presets"
        :key="preset.seed"
        class="swatch preset-swatch"
        :class="{ selected: !settings.customColor && settings.seed === preset.seed }"
        type="button"
        role="radio"
        :aria-checked="!settings.customColor && settings.seed === preset.seed"
        :aria-label="preset.name"
        :title="preset.name"
        @click="selectPreset(preset)"
      >
        <span
          class="quad"
          :style="{
            '--q1': preset.preview.lightPrimary,
            '--q2': preset.preview.lightSecondary,
            '--q3': preset.preview.darkPrimary,
            '--q4': preset.preview.darkSecondary,
          }"
        ></span>
      </button>
    </div>

    <div class="theme-row">
      <div class="theme-copy">
        <strong>深色主题</strong>
        <p>在暗光环境下使用更柔和的配色。</p>
      </div>
      <MSwitch v-model="settings.dark" aria-label="深色主题" />
    </div>

    <div class="theme-row compact">
      <span class="theme-hint">
        当前：{{ settings.customColor ? "自定义颜色" : presets.find((item) => item.seed === settings.seed)?.name ?? "自定义颜色" }}
      </span>
      <div class="theme-actions">
        <button
          class="text-button"
          type="button"
          :disabled="wallpaperBusy"
          @click="wallpaperInput?.click()"
        >
          <span class="material-symbols-rounded" aria-hidden="true">image</span>
          {{ wallpaperBusy ? "处理中…" : settings.backgroundImage ? "更换壁纸" : "选择壁纸" }}
        </button>
        <button
          v-if="settings.backgroundImage"
          class="text-button"
          type="button"
          @click="removeWallpaper"
        >
          移除壁纸
        </button>
        <button class="text-button" type="button" @click="resetColor">
          恢复默认紫色
        </button>
      </div>
    </div>

    <div v-if="settings.backgroundImage" class="wallpaper-block">
      <div class="wallpaper-preview" aria-label="壁纸实时预览">
        <div
          class="wallpaper-preview-image"
          :style="{
            backgroundImage: `url(${settings.backgroundImage})`,
            filter: `blur(${settings.backgroundBlur}px)`,
          }"
        ></div>
        <span class="wallpaper-preview-label">
          实时预览 · {{ settings.backgroundBlur }} px
        </span>
      </div>
      <div class="wallpaper-blur">
        <div class="wallpaper-blur-head">
          <strong>壁纸模糊度</strong>
          <span>{{ settings.backgroundBlur }} px</span>
        </div>
        <input
          v-model.number="settings.backgroundBlur"
          type="range"
          min="0"
          max="40"
          step="1"
          aria-label="壁纸模糊度"
        />
      </div>
    </div>

    <input
      ref="wallpaperInput"
      class="color-input"
      type="file"
      accept="image/*"
      tabindex="-1"
      aria-hidden="true"
      @change="onWallpaperSelected"
    />
  </div>
</template>

<style scoped>
.theme-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.theme-note {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.swatches {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  padding: 10px 8px 10px 16px;
}

.swatch {
  position: relative;
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition:
    transform 180ms var(--ease-emphasized),
    box-shadow 180ms ease;
}

.swatch:hover {
  transform: translateY(-2px);
}

.swatch.selected {
  box-shadow:
    0 0 0 3px var(--surface-card),
    0 0 0 6px var(--accent);
}

.preset-swatch {
  overflow: hidden;
}

.quad {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  background:
    linear-gradient(var(--q1), var(--q1)) 0 0 / 50% 50% no-repeat,
    linear-gradient(var(--q2), var(--q2)) 100% 0 / 50% 50% no-repeat,
    linear-gradient(var(--q3), var(--q3)) 0 100% / 50% 50% no-repeat,
    linear-gradient(var(--q4), var(--q4)) 100% 100% / 50% 50% no-repeat;
}

.custom-swatch {
  display: grid;
  place-items: center;
  border: 2px solid var(--border-subtle);
  border-radius: 19px;
  background: var(--surface-inner);
  color: var(--text-secondary);
}

.custom-swatch.selected {
  border-color: transparent;
}

.custom-color {
  position: absolute;
  inset: 0;
  border-radius: 17px;
  opacity: 0.9;
}

.custom-icon {
  position: relative;
  z-index: 1;
  font-size: 24px;
  color: var(--text-primary);
  mix-blend-mode: difference;
}

.color-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
}

.theme-row.compact {
  padding-top: 0;
  border-top: 0;
}

.theme-copy strong {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 680;
}

.theme-copy p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 11px;
}

.theme-hint {
  color: var(--text-secondary);
  font-size: 11px;
}

.wallpaper-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
}

.wallpaper-preview {
  position: relative;
  height: 180px;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 18px;
  background: var(--surface-inner);
}

.wallpaper-preview-image {
  position: absolute;
  inset: -50px;
  background-position: center;
  background-size: cover;
  transition: filter 100ms linear;
}

.wallpaper-preview-label {
  position: absolute;
  bottom: 12px;
  left: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-card) 82%, transparent);
  color: var(--text-primary);
  font-size: 10px;
  font-weight: 650;
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.wallpaper-blur {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.wallpaper-blur-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-primary);
  font-size: 11px;
}

.wallpaper-blur-head strong {
  font-weight: 680;
}

.wallpaper-blur-head span {
  color: var(--text-secondary);
  font-size: 10px;
}

.wallpaper-blur input[type="range"] {
  width: 100%;
  accent-color: var(--accent);
}

.theme-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.text-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}

.text-button:hover {
  background: var(--surface-hover);
}

.text-button:disabled {
  opacity: 0.55;
  cursor: default;
}

.text-button .material-symbols-rounded {
  font-size: 16px;
}
</style>
