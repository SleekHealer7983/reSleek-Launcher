<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { MSwitch } from "material/vue";
import TinyPinyin from "tiny-pinyin";
import { useCardDrag } from "../composables/useCardDrag";
import { beginPointerDrag, pointerDrag } from "../composables/pointerDrag";
import { fileSymbol, fileTypeLabel, formatBytes } from "../lib/files";
import type { DroppedDeviceFile, FileEntry, LauncherApp } from "../types";

const props = defineProps<{
  apps: LauncherApp[];
  loading: boolean;
  files: FileEntry[];
  filesLoading: boolean;
  notice: string;
}>();

const emit = defineEmits<{
  launch: [app: LauncherApp];
  openFile: [file: FileEntry];
  refreshApps: [];
  refreshAll: [];
  togglePin: [app: LauncherApp];
  reorderApps: [sourceId: string, targetId: string];
  recycleDesktopFile: [file: DroppedDeviceFile];
}>();

const showDesktopFiles = ref(true);
const query = ref("");

type AppView = "list" | "grid";
const APP_VIEW_KEY = "resleek.appView.v1";
type AppSort = "alpha" | "custom";
const APP_SORT_KEY = "resleek.appSort.v1";

function loadAppView(): AppView {
  try {
    return localStorage.getItem(APP_VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function loadAppSort(): AppSort {
  try {
    return localStorage.getItem(APP_SORT_KEY) === "custom" ? "custom" : "alpha";
  } catch {
    return "alpha";
  }
}

const viewMode = ref<AppView>(loadAppView());
const sortMode = ref<AppSort>(loadAppSort());

watch(viewMode, (value) => {
  try {
    localStorage.setItem(APP_VIEW_KEY, value);
  } catch {
    // A failed preference write should not block the launcher.
  }
});

watch(sortMode, (value) => {
  try {
    localStorage.setItem(APP_SORT_KEY, value);
  } catch {
    // A failed preference write should not block the launcher.
  }
});

const cardRef = ref<HTMLElement | null>(null);
const {
  style: dragStyle,
  dragging,
  start,
  move,
  end,
  reset,
} = useCardDrag(cardRef);

const featured = computed(() => props.apps.filter((app) => app.featured));
const needle = computed(() => query.value.trim().toLowerCase());
const rest = computed(() => props.apps.filter((app) => !app.featured));
const searchResults = computed(() =>
  needle.value
    ? props.apps.filter((app) => app.name.toLowerCase().includes(needle.value))
    : [],
);
const visibleApps = computed(() =>
  needle.value ? searchResults.value : rest.value,
);

const displayFiles = computed(
  () =>
    showDesktopFiles.value ||
    (pointerDrag.active && pointerDrag.payload?.kind === "file"),
);
const appDragId = computed(() =>
  pointerDrag.payload?.kind === "app" ? pointerDrag.payload.appId ?? null : null,
);
const appDropTargetId = computed(() => pointerDrag.targetAppId);

const appCountLabel = computed(() =>
  needle.value ? `${visibleApps.value.length} 个匹配` : `${props.apps.length} 个`,
);

const nameCollator = new Intl.Collator("zh-CN", {
  sensitivity: "base",
  numeric: true,
});
const pinyinInitialCache = new Map<string, string>();

function letterForName(name: string) {
  const first = name.trim().charAt(0);
  if (!first) return "#";
  if (/[A-Za-z]/.test(first)) return first.toUpperCase();
  if (/[0-9]/.test(first)) return "#";

  const cached = pinyinInitialCache.get(first);
  if (cached) return cached;

  let letter = "#";
  try {
    const converted = TinyPinyin.convertToPinyin(first, "", false);
    const initial = converted.charAt(0).toUpperCase();
    if (/^[A-Z]$/.test(initial)) letter = initial;
  } catch {
    // Unknown characters fall back to the symbol group.
  }
  pinyinInitialCache.set(first, letter);
  return letter;
}

const sortedVisibleApps = computed(() =>
  [...visibleApps.value].sort((a, b) => nameCollator.compare(a.name, b.name)),
);

const gridApps = computed(() =>
  sortMode.value === "alpha" ? sortedVisibleApps.value : visibleApps.value,
);

const appGroups = computed(() => {
  const groups = new Map<string, LauncherApp[]>();

  for (const app of sortedVisibleApps.value) {
    const letter = letterForName(app.name);
    const group = groups.get(letter);
    if (group) group.push(app);
    else groups.set(letter, [app]);
  }

  return [...groups.entries()]
    .map(([letter, apps]) => ({ letter, apps }))
    .sort((a, b) => {
      if (a.letter === "#") return -1;
      if (b.letter === "#") return 1;
      return a.letter.localeCompare(b.letter);
    });
});

function toneClass(app: LauncherApp) {
  return app.icon ? "with-image" : `tone-${app.tone}`;
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function startAppDrag(event: PointerEvent, app: LauncherApp) {
  if (event.button !== 0 || app.featured || sortMode.value !== "custom") return;
  const target = event.target as HTMLElement | null;
  if (target?.closest(".pin-button")) return;

  beginPointerDrag(
    event,
    {
      kind: "app",
      label: app.name,
      appId: app.id,
      icon: app.icon,
      symbol: app.symbol,
    },
    (payload, result) => {
      if (!payload.appId || !result.appId || payload.appId === result.appId) {
        return;
      }
      emit("reorderApps", payload.appId, result.appId);
    },
  );
}

function fileSubtitle(file: FileEntry) {
  if (file.isDir) return "文件夹";
  const type = fileTypeLabel(file.ext);
  const size = formatBytes(file.size);
  return size ? `${type} · ${size}` : type;
}

function startDesktopFileDrag(event: PointerEvent, file: FileEntry) {
  if (event.button !== 0) return;
  const payload: DroppedDeviceFile = {
    name: file.name,
    path: file.path || undefined,
    isDir: file.isDir,
    ext: file.ext,
    size: file.size,
    type: fileTypeLabel(file.ext, file.isDir),
    icon: fileSymbol(file.ext, file.isDir),
  };

  beginPointerDrag(
    event,
    {
      kind: "file",
      label: file.name,
      file: payload,
      symbol: payload.icon,
    },
    (dragged, result) => {
      if (dragged.file && result.zone === "recycle-bin") {
        emit("recycleDesktopFile", dragged.file);
      }
    },
  );
}
</script>

<template>
  <section
    ref="cardRef"
    class="desktop-card"
    :class="{ dragging }"
    :style="dragStyle"
  >
    <header
      class="card-header"
      title="按住可拖动卡片"
      @pointerdown="start"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
      @dblclick="reset"
    >
      <div class="card-heading">
        <div class="card-eyebrow">YOUR WORKSPACE</div>
        <h2 class="mtrl-headline-small">应用与文件</h2>
        <p>常用应用和桌面内容都在这里。</p>
      </div>

      <div class="header-actions">
        <button
          class="card-action"
          type="button"
          title="刷新应用与桌面文件"
          aria-label="刷新应用与桌面文件"
          @click.stop="emit('refreshAll')"
        >
          <span class="material-symbols-rounded" aria-hidden="true">refresh</span>
        </button>

        <div class="file-switch">
          <span>显示桌面文件</span>
          <MSwitch
            v-model="showDesktopFiles"
            aria-label="显示桌面文件"
          />
        </div>
      </div>
    </header>

    <div class="content-scroll">
      <section class="app-section">
        <div class="app-heading">
          <div class="section-heading">
            <h3>应用</h3>
            <span>{{ appCountLabel }}</span>
          </div>

          <div class="app-heading-tools">
            <label class="app-search">
              <span class="material-symbols-rounded" aria-hidden="true">search</span>
              <input
                v-model="query"
                type="search"
                placeholder="搜索应用"
                aria-label="搜索应用"
              />
            </label>

            <button
              class="view-toggle"
              type="button"
              :title="viewMode === 'list' ? '切换为图标视图' : '切换为列表视图'"
              :aria-label="viewMode === 'list' ? '切换为图标视图' : '切换为列表视图'"
              @click="viewMode = viewMode === 'list' ? 'grid' : 'list'"
            >
              <span class="view-toggle-prefix">视图：</span>
              <span class="material-symbols-rounded" aria-hidden="true">
                {{ viewMode === "list" ? "view_list" : "grid_view" }}
              </span>
              {{ viewMode === "list" ? "列表" : "图标" }}
            </button>

            <button
              v-if="viewMode === 'grid'"
              class="view-toggle"
              type="button"
              :title="sortMode === 'alpha' ? '切换为自定义排序' : '切换为字母排序'"
              :aria-label="sortMode === 'alpha' ? '切换为自定义排序' : '切换为字母排序'"
              @click="sortMode = sortMode === 'alpha' ? 'custom' : 'alpha'"
            >
              <span class="view-toggle-prefix">排序：</span>
              <span class="material-symbols-rounded" aria-hidden="true">
                {{ sortMode === "alpha" ? "sort_by_alpha" : "swap_vert" }}
              </span>
              {{ sortMode === "alpha" ? "字母" : "自定义" }}
            </button>
          </div>
        </div>

        <div class="app-scroll">
          <Transition name="featured">
            <div v-if="!query && featured.length" class="featured-row">
              <div
                v-for="app in featured"
                :key="app.id"
                class="featured-cell"
                :data-drop-target="app.special === 'recycle-bin' ? 'recycle-bin' : undefined"
                :class="{
                  'recycle-drop-active':
                    app.special === 'recycle-bin' &&
                    pointerDrag.zone === 'recycle-bin',
                }"
              >
                <button
                  class="featured-item"
                  type="button"
                  :aria-label="`打开 ${app.name}`"
                  @click="emit('launch', app)"
                >
                  <span class="featured-icon" :class="toneClass(app)">
                    <img
                      v-if="app.icon"
                      :src="app.icon"
                      alt=""
                      draggable="false"
                    />
                    <span
                      v-else-if="app.symbol"
                      class="material-symbols-rounded"
                      aria-hidden="true"
                    >
                      {{ app.symbol }}
                    </span>
                    <span v-else class="app-initial">{{ initial(app.name) }}</span>
                  </span>
                  <span class="featured-name">{{ app.name }}</span>
                  <span class="featured-tag">
                    {{ app.special === "this-pc" || app.special === "recycle-bin" ? "系统" : "C 位" }}
                  </span>
                </button>

                <button
                  v-if="!app.special"
                  class="pin-button featured-pin active"
                  type="button"
                  title="取消 C 位"
                  aria-label="取消 C 位"
                  @click.stop="emit('togglePin', app)"
                >
                  <span class="material-symbols-rounded" aria-hidden="true">keep</span>
                </button>
              </div>
            </div>
          </Transition>

          <div v-if="loading" class="app-grid" aria-hidden="true">
            <div
              v-for="index in 8"
              :key="index"
              class="app-item skeleton"
            >
              <span class="app-icon skeleton-icon"></span>
              <span class="skeleton-line"></span>
            </div>
          </div>

          <div v-else-if="!visibleApps.length" class="empty-state">
            <span class="material-symbols-rounded" aria-hidden="true">
              {{ query ? "search_off" : "apps" }}
            </span>
            <p>{{ query ? "没有找到匹配的应用" : "没有读取到应用" }}</p>
            <button
              v-if="!query"
              class="empty-action"
              type="button"
              @click="emit('refreshApps')"
            >
              重新扫描
            </button>
          </div>

          <div v-else-if="viewMode === 'grid'" class="app-grid">
            <div
              v-for="app in gridApps"
              :key="app.id"
              class="app-cell"
              data-app-cell
              :data-app-id="app.id"
              :class="{
                'app-dragging': appDragId === app.id,
                'app-drop-target': appDropTargetId === app.id,
              }"
              @pointerdown="startAppDrag($event, app)"
            >
              <button
                class="app-item"
                type="button"
                :aria-label="`打开 ${app.name}`"
                @click="emit('launch', app)"
              >
                <span class="app-icon" :class="toneClass(app)">
                  <img
                    v-if="app.icon"
                    :src="app.icon"
                    alt=""
                    draggable="false"
                  />
                  <span
                    v-else-if="app.symbol"
                    class="material-symbols-rounded"
                    aria-hidden="true"
                  >
                    {{ app.symbol }}
                  </span>
                  <span v-else class="app-initial">{{ initial(app.name) }}</span>
                </span>
                <span class="app-name">{{ app.name }}</span>
              </button>

              <button
                class="pin-button"
                :class="{ active: app.featured }"
                type="button"
                :title="app.featured ? '取消 C 位' : '加入 C 位'"
                :aria-label="app.featured ? '取消 C 位' : '加入 C 位'"
                @click.stop="emit('togglePin', app)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  {{ app.featured ? "keep" : "push_pin" }}
                </span>
              </button>
            </div>
          </div>

          <div v-else class="app-list">
            <section
              v-for="group in appGroups"
              :key="group.letter"
              class="app-group"
            >
              <div class="app-group-letter">{{ group.letter }}</div>

              <div class="app-group-rows">
                <div
                  v-for="app in group.apps"
                  :key="app.id"
                  class="app-row"
                >
                  <button
                    class="app-row-main"
                    type="button"
                    :aria-label="`打开 ${app.name}`"
                    @click="emit('launch', app)"
                  >
                    <span class="app-row-icon" :class="toneClass(app)">
                      <img
                        v-if="app.icon"
                        :src="app.icon"
                        alt=""
                        draggable="false"
                      />
                      <span
                        v-else-if="app.symbol"
                        class="material-symbols-rounded"
                        aria-hidden="true"
                      >
                        {{ app.symbol }}
                      </span>
                      <span v-else class="app-initial">{{ initial(app.name) }}</span>
                    </span>
                    <span class="app-row-name">{{ app.name }}</span>
                  </button>

                  <button
                    class="list-pin"
                    type="button"
                    title="加入 C 位"
                    aria-label="加入 C 位"
                    @click.stop="emit('togglePin', app)"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      push_pin
                    </span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>

      <Transition name="files-transition">
        <div
          v-if="displayFiles"
          class="file-drop-wrap"
          data-drop-target="desktop-files"
        >
          <section class="file-section">
          <div class="file-heading">
            <div class="section-heading">
              <h3>桌面文件</h3>
              <span>{{ files.length }} 个</span>
            </div>
            <span class="drop-hint">
              <span class="material-symbols-rounded" aria-hidden="true">move_to_inbox</span>
              把 U 盘文件拖到这里
            </span>
          </div>

          <div v-if="filesLoading" class="file-grid">
            <div
              v-for="index in 3"
              :key="index"
              class="file-item skeleton"
            >
              <span class="file-icon skeleton-icon"></span>
              <span class="skeleton-line wide"></span>
            </div>
          </div>

          <div v-else-if="!files.length" class="empty-files">
            <span class="material-symbols-rounded" aria-hidden="true">folder_open</span>
            <span>桌面还没有文件，试着从 U 盘拖一个过来。</span>
          </div>

          <div v-else class="file-grid">
            <button
              v-for="file in files"
              :key="file.path || file.name"
              class="file-item"
              type="button"
              @pointerdown="startDesktopFileDrag($event, file)"
              @click="emit('openFile', file)"
            >
              <span class="file-icon">
                <img
                  v-if="file.name.toLowerCase() === 'sleekwow.png'"
                  class="file-thumb"
                  src="/assets/sleekwow.png"
                  alt=""
                  draggable="false"
                />
                <span v-else class="material-symbols-rounded" aria-hidden="true">
                  {{ fileSymbol(file.ext, file.isDir) }}
                </span>
              </span>
              <span class="file-info">
                <strong>{{ file.name }}</strong>
                <small>{{ fileSubtitle(file) }}</small>
              </span>
            </button>
          </div>
          </section>
        </div>
      </Transition>
    </div>

    <Transition name="notice">
      <div v-if="notice" class="card-notice" role="status">{{ notice }}</div>
    </Transition>
  </section>
</template>

<style scoped>
.desktop-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 27px 30px 22px;
  border: 1px solid var(--border-subtle);
  border-radius: 32px;
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
  transition:
    box-shadow 220ms ease,
    border-color 220ms ease;
}

.desktop-card.dragging {
  border-color: var(--focus-ring);
  box-shadow: var(--shadow-card-dragging);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
}

.card-action {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.card-action:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.card-action .material-symbols-rounded {
  font-size: 18px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.desktop-card.dragging .card-header {
  cursor: grabbing;
}

.card-heading {
  min-width: 0;
}

.card-eyebrow {
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.14em;
}

.card-header h2 {
  margin: 7px 0 4px;
  color: var(--text-primary);
  letter-spacing: -0.2px;
}

.card-header p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.file-switch {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.content-scroll {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-top: 18px;
  overflow: hidden;
}

.app-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.app-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  margin-bottom: 8px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.section-heading h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.1px;
  white-space: nowrap;
}

.section-heading span {
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.app-search {
  display: flex;
  align-items: center;
  gap: 7px;
  width: min(220px, 40%);
  padding: 6px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-inner);
  color: var(--text-secondary);
}

.app-heading-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.app-heading-tools .app-search {
  width: min(220px, 34vw);
}

.view-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 7px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.view-toggle:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.view-toggle-prefix {
  color: var(--text-secondary);
  font-weight: 500;
}

.view-toggle .material-symbols-rounded {
  font-size: 16px;
}

.app-search .material-symbols-rounded {
  font-size: 18px;
}

.app-search input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
}

.app-search input::placeholder {
  color: var(--text-secondary);
}

.app-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
  overscroll-behavior: contain;
}

.featured-row {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 0 18px;
}

.featured-cell {
  position: relative;
  width: 142px;
}

.featured-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 14px 10px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 24px;
  background: var(--surface-elevated);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform 200ms var(--ease-emphasized),
    background 180ms ease,
    box-shadow 180ms ease;
}

.featured-item:hover {
  transform: translateY(-3px);
  background: var(--surface-inner);
  box-shadow: var(--shadow-card);
}

.featured-item:active {
  transform: translateY(-1px) scale(0.98);
}

.featured-icon {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border-radius: 22px;
  box-shadow: 0 2px 8px rgba(35, 24, 48, 0.08);
}

.featured-icon .material-symbols-rounded {
  font-size: 34px;
}

.featured-icon .app-initial {
  font-size: 28px;
}

.app-initial {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font-size: 20px;
  font-weight: 750;
  line-height: 1;
}

.featured-icon img {
  width: 44px;
  height: 44px;
  object-fit: contain;
  border-radius: 8px;
}

.featured-name {
  max-width: 100%;
  overflow: hidden;
  font-size: 12px;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.featured-tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-card);
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 600;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
  gap: 14px 10px;
  padding-bottom: 8px;
}

.app-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-bottom: 8px;
}

.app-group {
  display: flex;
  flex-direction: column;
}

.app-group-letter {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 8px 4px;
  background: var(--surface-card);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.app-group-rows {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.app-row {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  border-radius: 12px;
  transition: background 150ms ease;
}

.app-row:hover {
  background: var(--surface-hover);
}

.app-row-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.app-row-main:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

.app-row-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 10px;
  color: var(--text-primary);
}

.app-row-icon.with-image {
  padding: 4px;
  background: var(--surface-card);
}

.app-row-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

.app-row-icon .material-symbols-rounded {
  font-size: 18px;
}

.app-row-icon .app-initial {
  font-size: 14px;
}

.app-row-name {
  overflow: hidden;
  font-size: 12px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-pin {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  margin-right: 4px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  opacity: 0;
  cursor: pointer;
  transition:
    opacity 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.app-row:hover .list-pin,
.list-pin:focus-visible {
  opacity: 1;
}

.list-pin:hover {
  background: var(--surface-card);
  color: var(--text-primary);
}

.list-pin .material-symbols-rounded {
  font-size: 16px;
}

.app-cell {
  position: relative;
  min-width: 0;
  user-select: none;
}

.app-cell .app-item {
  width: 100%;
}

.app-cell.app-dragging {
  opacity: 0.4;
}

.app-cell.app-drop-target {
  border-radius: 18px;
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
}

.pin-button {
  position: absolute;
  z-index: 2;
  top: 1px;
  right: 1px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  background: var(--surface-card);
  color: var(--text-secondary);
  box-shadow: 0 1px 3px rgba(35, 24, 48, 0.12);
  opacity: 0;
  cursor: pointer;
  transition:
    opacity 160ms ease,
    color 160ms ease,
    background 160ms ease;
}

.app-cell:hover .pin-button,
.featured-cell:hover .pin-button,
.pin-button.active {
  opacity: 1;
}

.pin-button:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.pin-button.active {
  color: var(--accent);
}

.pin-button .material-symbols-rounded {
  font-size: 15px;
}

.featured-pin {
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
}

.app-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 4px 10px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition:
    background 180ms ease,
    transform 180ms ease;
}

.app-item:hover {
  background: var(--surface-hover);
  transform: translateY(-3px);
}

.app-item:active {
  transform: translateY(-1px) scale(0.97);
}

.app-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 17px;
  box-shadow: 0 2px 6px rgba(35, 24, 48, 0.07);
  transition:
    border-radius 220ms ease,
    background 180ms ease;
}

.app-item:hover .app-icon {
  border-radius: 14px;
}

.app-icon .material-symbols-rounded {
  font-size: 26px;
  font-variation-settings:
    "FILL" 1,
    "wght" 400,
    "GRAD" 0,
    "opsz" 24;
}

.app-icon.with-image {
  padding: 7px;
  background: var(--surface-inner);
}

.app-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

.app-name {
  max-width: 100%;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-drop-wrap {
  position: relative;
  flex-shrink: 0;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
}

.file-section {
  max-height: 218px;
  overflow-y: auto;
  border-radius: 14px;
}

.featured-cell.recycle-drop-active .featured-item {
  border-color: var(--mtrl-sys-color-error, #b3261e);
  background: var(--mtrl-sys-color-error-container, #f9dedc);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--mtrl-sys-color-error, #b3261e) 35%, transparent),
    var(--shadow-card);
}

.featured-cell.recycle-drop-active .featured-tag {
  color: var(--mtrl-sys-color-on-error-container, #410e0b);
}

.file-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 10px;
}

.drop-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
  font-size: 10px;
  white-space: nowrap;
}

.drop-hint .material-symbols-rounded {
  font-size: 16px;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(172px, 1fr));
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 9px 11px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: var(--surface-inner);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    background 180ms ease,
    border-color 180ms ease;
}

.file-item:hover {
  border-color: var(--border-subtle);
  background: var(--surface-hover);
}

.file-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 11px;
  background: var(--surface-card);
  color: var(--accent);
}

.file-icon .material-symbols-rounded {
  font-size: 20px;
}

.file-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.file-info strong {
  overflow: hidden;
  font-size: 11px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-info small {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state,
.empty-files {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 11px;
}

.empty-state {
  flex-direction: column;
  min-height: 160px;
}

.empty-state .material-symbols-rounded {
  font-size: 34px;
}

.empty-state p {
  margin: 0;
}

.empty-action {
  margin-top: 4px;
  padding: 6px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}

.empty-files {
  padding: 14px;
  border: 1px dashed var(--border-subtle);
  border-radius: 14px;
}

.empty-files .material-symbols-rounded {
  font-size: 20px;
}

.card-notice {
  position: absolute;
  z-index: 3;
  bottom: 18px;
  left: 50%;
  max-width: calc(100% - 40px);
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--mtrl-sys-color-inverse-surface, #322f35);
  color: var(--mtrl-sys-color-inverse-on-surface, #f5eff7);
  box-shadow: var(--shadow-card);
  font-size: 11px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
  transform: translateX(-50%);
}

.skeleton {
  pointer-events: none;
}

.skeleton-icon,
.skeleton-line {
  background: var(--surface-inner);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-icon {
  border-radius: 17px;
}

.skeleton-line {
  width: 46px;
  height: 8px;
  border-radius: 999px;
}

.skeleton-line.wide {
  width: 90px;
  height: 10px;
}

.featured-enter-active,
.featured-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms var(--ease-emphasized);
}

.featured-enter-from,
.featured-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.files-transition-enter-active,
.files-transition-leave-active {
  transition:
    opacity 220ms ease,
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.files-transition-enter-from,
.files-transition-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.notice-enter-active,
.notice-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms var(--ease-emphasized);
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

@media (max-width: 700px) {
  .desktop-card {
    padding: 22px;
    border-radius: 26px;
  }

  .card-header {
    flex-direction: column;
    gap: 12px;
  }

  .file-switch {
    padding-top: 0;
  }

  .app-search {
    width: 45%;
  }

  .drop-hint {
    display: none;
  }
}
</style>
