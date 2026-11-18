<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { MSwitch } from "material/vue";
import ThemePicker from "../components/ThemePicker.vue";
import ClockDisplay from "../components/ClockDisplay.vue";
import {
  isDesktop,
  removeSystemAutostart,
  systemAutostartExists,
} from "../services/backend";
import { resetSettings, settings } from "../settings";

type SectionId =
  | "appearance"
  | "clock"
  | "behavior"
  | "language"
  | "developer"
  | "about";

interface SettingsSection {
  id: SectionId;
  title: string;
  description: string;
  icon: string;
}

const sections: SettingsSection[] = [
  {
    id: "appearance",
    title: "外观与个性化",
    description: "主题配色、自定义背景和深色模式",
    icon: "palette",
  },
  {
    id: "clock",
    title: "时间显示",
    description: "右上角时钟、日期和节假日",
    icon: "schedule",
  },
  {
    id: "behavior",
    title: "桌面行为",
    description: "开机启动、全屏和窗口显示",
    icon: "desktop_windows",
  },
  {
    id: "language",
    title: "语言与区域",
    description: "界面语言和区域格式",
    icon: "language",
  },
  {
    id: "developer",
    title: "开发者选项",
    description: "系统应用和已隐藏的应用",
    icon: "developer_mode",
  },
  {
    id: "about",
    title: "关于 reSleek Launcher",
    description: "版本信息与开源组件",
    icon: "info",
  },
];

const activeSectionId = ref<SectionId>("appearance");
const search = ref("");

const filteredSections = computed(() => {
  const needle = search.value.trim().toLowerCase();
  if (!needle) return sections;
  return sections.filter(
    (section) =>
      section.title.toLowerCase().includes(needle) ||
      section.description.toLowerCase().includes(needle),
  );
});

const activeSection = computed(
  () =>
    sections.find((section) => section.id === activeSectionId.value) ??
    sections[0],
);

watch(search, () => {
  const results = filteredSections.value;
  if (
    results.length &&
    !results.some((section) => section.id === activeSectionId.value)
  ) {
    activeSectionId.value = results[0].id;
  }
});

const autostart = ref(false);
const autostartBusy = ref(false);
const autostartError = ref("");
const autostartSystem = ref(false);
const fullscreen = ref(settings.fullscreen);
const fullscreenBusy = ref(false);

async function readAutostartState() {
  const { isEnabled } = await import("@tauri-apps/plugin-autostart");
  autostart.value = await isEnabled();
  autostartSystem.value = await systemAutostartExists();
}

onMounted(async () => {
  if (!isDesktop) return;

  try {
    await readAutostartState();
  } catch {
    autostartError.value = "无法读取开机启动状态";
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    fullscreen.value = await getCurrentWindow().isFullscreen();
    settings.fullscreen = fullscreen.value;
  } catch {
    // Keep the persisted preference when the window API is unavailable.
  }
});

async function setAutostart(value: boolean) {
  if (!isDesktop || autostartBusy.value) return;
  autostartBusy.value = true;
  autostartError.value = "";
  try {
    const plugin = await import("@tauri-apps/plugin-autostart");

    if (value) {
      // Old elevated runs wrote to HKLM. Migrate to a per-user entry after
      // removing the system-level value with an explicit UAC prompt.
      if (autostartSystem.value) await removeSystemAutostart();
      await plugin.enable();
    } else {
      await plugin.disable();
      // A non-elevated process cannot delete HKLM; ask for elevation only
      // when a stale system-level entry is actually present.
      if (autostartSystem.value) await removeSystemAutostart();
    }

    await readAutostartState();
    if (autostart.value !== value) {
      autostartError.value = value
        ? "开机启动没有成功启用"
        : "系统级启动项未移除，需要管理员权限";
    }
  } catch (error) {
    console.error(error);
    autostartError.value = value
      ? "设置开机启动失败"
      : "关闭失败：系统级启动项需要管理员权限";
    try {
      await readAutostartState();
    } catch {
      // Keep the current switch state when the status cannot be read.
    }
  } finally {
    autostartBusy.value = false;
  }
}

async function setFullscreen(value: boolean) {
  if (fullscreenBusy.value) return;
  fullscreenBusy.value = true;
  fullscreen.value = value;
  settings.fullscreen = value;
  try {
    if (isDesktop) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setFullscreen(value);
    }
  } catch {
    // The preference is still saved for the next launch.
  } finally {
    fullscreenBusy.value = false;
  }
}

function restoreDefaults() {
  resetSettings();
  fullscreen.value = settings.fullscreen;
  void setFullscreen(settings.fullscreen);
}

function restoreHiddenApps() {
  settings.hiddenApps = [];
}
</script>

<template>
  <section class="settings-page">
    <div class="settings-shell">
      <aside class="settings-nav">
        <label class="settings-search">
          <span class="material-symbols-rounded" aria-hidden="true">search</span>
          <input
            v-model="search"
            type="search"
            placeholder="在设置中搜索"
            aria-label="在设置中搜索"
          />
        </label>

        <div class="settings-nav-list">
          <button
            v-for="section in filteredSections"
            :key="section.id"
            class="settings-nav-item"
            :class="{ active: activeSectionId === section.id }"
            type="button"
            @click="activeSectionId = section.id"
          >
            <span class="settings-nav-icon material-symbols-rounded" aria-hidden="true">
              {{ section.icon }}
            </span>
            <span class="settings-nav-copy">
              <strong>{{ section.title }}</strong>
              <small>{{ section.description }}</small>
            </span>
            <span class="settings-nav-chevron material-symbols-rounded" aria-hidden="true">
              chevron_right
            </span>
          </button>

          <p v-if="!filteredSections.length" class="settings-nav-empty">
            没有找到设置项
          </p>
        </div>

        <div class="settings-nav-footer">reSleek Launcher 0.1.0</div>
      </aside>

      <section class="settings-detail">
        <header class="settings-detail-header">
          <div class="settings-eyebrow">SETTINGS</div>
          <h2>{{ activeSection.title }}</h2>
          <p>{{ activeSection.description }}</p>
        </header>

        <div class="settings-detail-body">
          <template v-if="activeSectionId === 'appearance'">
            <section class="settings-group">
              <div class="settings-group-title">
                <h3>主题与壁纸</h3>
                <p>选择壁纸会同时更新启动器背景、模糊度和主题色。</p>
              </div>
              <ThemePicker />
            </section>
          </template>

          <template v-else-if="activeSectionId === 'clock'">
            <section class="settings-group">
              <div class="settings-group-title">
                <h3>右上角时钟</h3>
                <p>显示在标题栏右侧，实时更新。</p>
              </div>

              <div class="clock-preview-card">
                <ClockDisplay v-if="settings.clockEnabled" preview />
                <span v-else class="clock-preview-off">右上角时钟已关闭</span>
                <span class="clock-preview-note">实时预览 · 实际显示在右上角</span>
              </div>

              <div class="setting-row">
                <div class="setting-copy">
                  <strong>显示右上角时钟</strong>
                  <p>关闭后标题栏右侧不再显示时间。</p>
                </div>
                <MSwitch
                  v-model="settings.clockEnabled"
                  aria-label="显示右上角时钟"
                />
              </div>

              <div class="setting-row">
                <div class="setting-copy">
                  <strong>显示时钟背景</strong>
                  <p>关闭后只保留时间文字，不再显示胶囊/毛玻璃底。</p>
                </div>
                <MSwitch
                  v-model="settings.clockBackground"
                  :disabled="!settings.clockEnabled"
                  aria-label="显示时钟背景"
                />
              </div>

              <div class="setting-row">
                <div class="setting-copy">
                  <strong>显示日期</strong>
                  <p>在时间下方显示今天的年月日。</p>
                </div>
                <MSwitch
                  v-model="settings.clockShowDate"
                  :disabled="!settings.clockEnabled"
                  aria-label="显示日期"
                />
              </div>

              <div class="setting-row">
                <div class="setting-copy">
                  <strong>显示节假日</strong>
                  <p>显示常见节日或周末；不含调休安排。</p>
                </div>
                <MSwitch
                  v-model="settings.clockShowHoliday"
                  :disabled="!settings.clockEnabled"
                  aria-label="显示节假日"
                />
              </div>

              <div class="setting-row">
                <div class="setting-copy">
                  <strong>显示秒数</strong>
                  <p>时间精确到秒。</p>
                </div>
                <MSwitch
                  v-model="settings.clockShowSeconds"
                  :disabled="!settings.clockEnabled"
                  aria-label="显示秒数"
                />
              </div>

              <div class="setting-row">
                <div class="setting-copy">
                  <strong>显示毫秒</strong>
                  <p>需要同时开启秒数；会高频刷新，仅建议展示时使用。</p>
                </div>
                <MSwitch
                  v-model="settings.clockShowMilliseconds"
                  :disabled="!settings.clockEnabled || !settings.clockShowSeconds"
                  aria-label="显示毫秒"
                />
              </div>

              <p class="settings-hint">
                节假日数据为常见节日和周末的本地计算，不包含每年调休安排。
              </p>
            </section>
          </template>

          <template v-else-if="activeSectionId === 'behavior'">
            <section class="settings-group">
              <div class="setting-row">
                <div class="setting-copy">
                  <strong>开机自启动</strong>
                  <p>登录 Windows 后自动打开 reSleek Launcher。</p>
                  <span v-if="!isDesktop" class="setting-note">仅在桌面端可用</span>
                  <span v-else-if="autostartError" class="setting-error">{{ autostartError }}</span>
                  <span v-else-if="autostartSystem" class="setting-note">
                    检测到系统级启动项（HKLM）；关闭时会请求管理员权限。
                  </span>
                </div>
                <MSwitch
                  :model-value="autostart"
                  :disabled="!isDesktop || autostartBusy"
                  aria-label="开机自启动"
                  @update:model-value="setAutostart"
                />
              </div>

              <div class="setting-row">
                <div class="setting-copy">
                  <strong>全屏模式</strong>
                  <p>启动器铺满整个屏幕，按 F11 可以随时切换。</p>
                </div>
                <MSwitch
                  :model-value="fullscreen"
                  :disabled="fullscreenBusy"
                  aria-label="全屏模式"
                  @update:model-value="setFullscreen"
                />
              </div>

              <p class="settings-hint">
                提示：图标视图默认按字母排序；需要自定义顺序时切到「排序：自定义」，再拖动图标。悬停图标后点图钉可加入 / 移出 C 位。
              </p>
            </section>
          </template>

          <template v-else-if="activeSectionId === 'language'">
            <section class="settings-group">
              <div class="setting-row static">
                <div class="setting-copy">
                  <strong>简体中文</strong>
                  <p>目前使用系统语言，英语等更多语言正在准备。</p>
                </div>
                <span class="status-pill">跟随系统</span>
              </div>
            </section>
          </template>

          <template v-else-if="activeSectionId === 'developer'">
            <section class="settings-group">
              <div class="setting-row">
                <div class="setting-copy">
                  <strong>显示系统应用</strong>
                  <p>在应用列表中显示 Windows 系统工具和内置应用。</p>
                </div>
                <MSwitch
                  v-model="settings.showSystemApps"
                  aria-label="显示系统应用"
                />
              </div>

              <div class="setting-row">
                <div class="setting-copy">
                  <strong>已隐藏的应用</strong>
                  <p>启动失败后选择移除的应用会记在这里，可以一键恢复。</p>
                </div>
                <button
                  class="status-pill action-pill"
                  type="button"
                  :disabled="!settings.hiddenApps.length"
                  @click="restoreHiddenApps"
                >
                  {{ settings.hiddenApps.length ? `恢复 ${settings.hiddenApps.length} 个` : "无" }}
                </button>
              </div>
            </section>
          </template>

          <template v-else>
            <section class="settings-group">
              <div class="about-list">
                <div class="about-row">
                  <span>作者（？</span>
                  <strong>reSleek Healer & DeepSeek（用🖐️、🐋和❤️创作）</strong>
                </div>
                <div class="about-row">
                  <span>版本</span>
                  <strong>0.1.0</strong>
                </div>
                <div class="about-row">
                  <span>界面框架</span>
                  <strong>Tauri 2 · Vue 3</strong>
                </div>
                <div class="about-row">
                  <span>设计系统</span>
                  <strong>Material 3 Expressive</strong>
                </div>
                <div class="about-row">
                  <span>图标</span>
                  <strong>Material Symbols Rounded</strong>
                </div>
              </div>

              <button class="restore-button" type="button" @click="restoreDefaults">
                <span class="material-symbols-rounded" aria-hidden="true">restart_alt</span>
                恢复默认主题与设置
              </button>
            </section>
          </template>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.settings-page {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.settings-shell {
  display: grid;
  grid-template-columns: minmax(310px, 34%) minmax(0, 1fr);
  gap: 14px;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 14px;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 28px;
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.settings-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-bottom: 12px;
  padding: 10px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-inner);
  color: var(--text-secondary);
}

.settings-search .material-symbols-rounded {
  font-size: 19px;
}

.settings-search input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
}

.settings-search input::placeholder {
  color: var(--text-secondary);
}

.settings-nav-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  margin-bottom: 3px;
  padding: 10px 10px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.settings-nav-item:hover {
  background: var(--surface-hover);
}

.settings-nav-item.active {
  background: var(--accent-container);
  color: var(--on-accent-container);
}

.settings-nav-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--surface-inner);
  color: var(--text-secondary);
  font-size: 21px;
}

.settings-nav-item.active .settings-nav-icon {
  background: color-mix(in srgb, var(--surface-card) 48%, transparent);
  color: var(--on-accent-container);
}

.settings-nav-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.settings-nav-copy strong {
  overflow: hidden;
  font-size: 12px;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-nav-copy small {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-nav-item.active .settings-nav-copy small {
  color: color-mix(in srgb, var(--on-accent-container) 70%, transparent);
}

.settings-nav-chevron {
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 18px;
}

.settings-nav-item.active .settings-nav-chevron {
  color: var(--on-accent-container);
}

.settings-nav-empty {
  padding: 18px 8px;
  color: var(--text-secondary);
  font-size: 11px;
  text-align: center;
}

.settings-nav-footer {
  flex-shrink: 0;
  padding: 10px 8px 2px;
  color: var(--text-secondary);
  font-size: 9px;
  letter-spacing: 0.03em;
}

.settings-detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 24px 28px 20px;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 28px;
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.settings-detail-header {
  flex-shrink: 0;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.settings-eyebrow {
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.14em;
}

.settings-detail-header h2 {
  margin: 6px 0 4px;
  color: var(--text-primary);
  font-size: 27px;
  font-weight: 730;
  letter-spacing: -0.6px;
}

.settings-detail-header p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.settings-detail-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-top: 18px;
  padding-right: 2px;
}

.settings-group {
  padding-bottom: 22px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--border-subtle);
}

.settings-group:last-child {
  margin-bottom: 0;
  padding-bottom: 4px;
  border-bottom: 0;
}

.settings-group-title {
  margin-bottom: 14px;
}

.settings-group-title h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.settings-group-title p {
  margin: 3px 0 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.clock-preview-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
}

.clock-preview-note {
  color: var(--text-secondary);
  font-size: 10px;
}

.clock-preview-off {
  padding: 16px 20px;
  border: 1px dashed var(--border-subtle);
  border-radius: 22px;
  color: var(--text-secondary);
  font-size: 12px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
}

.setting-row + .setting-row {
  border-top: 1px solid var(--border-subtle);
}

.setting-row.static {
  padding-top: 0;
  padding-bottom: 0;
}

.setting-copy {
  min-width: 0;
}

.setting-copy strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 680;
}

.setting-copy p {
  margin: 3px 0 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.setting-note,
.setting-error {
  display: inline-block;
  margin-top: 4px;
  font-size: 10px;
}

.setting-note {
  color: var(--text-secondary);
}

.setting-error {
  color: var(--mtrl-sys-color-error, #b3261e);
}

.settings-hint {
  margin: 12px 0 0;
  padding-top: 11px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1.5;
}

.status-pill {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--surface-inner);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.action-pill {
  border: 0;
  cursor: pointer;
}

.action-pill:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.action-pill:disabled {
  opacity: 0.55;
  cursor: default;
}

.about-list {
  display: flex;
  flex-direction: column;
}

.about-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  color: var(--text-secondary);
  font-size: 11px;
}

.about-row + .about-row {
  border-top: 1px solid var(--border-subtle);
}

.about-row > span {
  flex-shrink: 0;
  white-space: nowrap;
}

.about-row strong {
  min-width: 0;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.5;
  text-align: right;
}

.restore-button {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 16px;
  padding: 8px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 180ms ease,
    color 180ms ease;
}

.restore-button:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.restore-button .material-symbols-rounded {
  font-size: 17px;
}

@media (max-width: 900px) {
  .settings-shell {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(160px, 32%) minmax(0, 1fr);
  }

  .settings-nav {
    padding: 10px;
  }

  .settings-nav-list {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .settings-nav-item {
    width: auto;
    min-width: 200px;
    margin-bottom: 0;
  }

  .settings-nav-footer {
    display: none;
  }

  .settings-detail {
    padding: 20px;
  }
}
</style>
