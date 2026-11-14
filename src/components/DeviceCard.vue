<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useCardDrag } from "../composables/useCardDrag";
import { beginPointerDrag, pointerDrag } from "../composables/pointerDrag";
import { fileSymbol, fileTypeLabel, formatBytes } from "../lib/files";
import type { DriveEntry, DroppedDeviceFile, FileEntry } from "../types";

const props = withDefaults(
  defineProps<{
    connected?: boolean;
    device?: DriveEntry | null;
    files?: FileEntry[];
    loading?: boolean;
    folderName?: string;
    canGoBack?: boolean;
    ejecting?: boolean;
  }>(),
  {
    connected: false,
    device: null,
    files: () => [],
    loading: false,
    folderName: "",
    canGoBack: false,
    ejecting: false,
  },
);

const emit = defineEmits<{
  disconnect: [];
  openFile: [file: FileEntry];
  refresh: [];
  goBack: [];
  eject: [];
  dropOnDesktop: [file: DroppedDeviceFile];
  recycleFile: [file: DroppedDeviceFile];
}>();

const cardRef = ref<HTMLElement | null>(null);
const filesRef = ref<HTMLElement | null>(null);
const {
  style: dragStyle,
  dragging,
  start,
  move,
  end,
  reset,
} = useCardDrag(cardRef);

watch(
  () => props.connected,
  (connected) => {
    if (connected) reset();
  },
);

watch(
  () => props.folderName,
  async () => {
    await nextTick();
    filesRef.value?.scrollTo({ top: 0 });
  },
);

function subtitle(file: FileEntry) {
  if (file.isDir) return "文件夹";
  const type = fileTypeLabel(file.ext);
  const size = formatBytes(file.size);
  return size ? `${type} · ${size}` : type;
}

function startFileDrag(event: PointerEvent, file: FileEntry) {
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
      if (!dragged.file) return;
      if (result.zone === "desktop-files") {
        emit("dropOnDesktop", dragged.file);
      } else if (result.zone === "recycle-bin") {
        emit("recycleFile", dragged.file);
      }
    },
  );
}

function isDraggingFile(file: FileEntry) {
  return (
    pointerDrag.active &&
    pointerDrag.payload?.kind === "file" &&
    pointerDrag.payload.file?.name === file.name
  );
}

const freeLabel = () => {
  if (!props.device) return "";
  const free = formatBytes(props.device.free);
  const total = formatBytes(props.device.total);
  if (!free || !total) return `${props.device.letter} · 已连接`;
  return `${props.device.letter} · 可用 ${free} / ${total}`;
};
</script>

<template>
  <aside
    ref="cardRef"
    class="device-card"
    :class="{ connected, dragging }"
    :style="dragStyle"
    :inert="connected ? undefined : true"
    :aria-hidden="!connected"
  >
    <header
      class="device-header"
      title="按住可拖动卡片"
      @pointerdown="start"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
      @dblclick="reset"
    >
      <div class="device-symbol">
        <span class="material-symbols-rounded" aria-hidden="true">usb</span>
      </div>

      <div class="device-title">
        <div class="device-eyebrow">CONNECTED DEVICE</div>
        <h2>{{ device?.label || "可移动设备" }}</h2>
        <span>{{ freeLabel() }}</span>
      </div>

      <div class="device-actions">
        <button
          class="device-action"
          type="button"
          aria-label="刷新设备文件"
          title="刷新设备文件"
          :disabled="loading"
          @click="emit('refresh')"
        >
          <span
            class="material-symbols-rounded"
            :class="{ spinning: loading }"
            aria-hidden="true"
          >
            refresh
          </span>
        </button>
        <button
          class="device-action"
          type="button"
          aria-label="收起设备卡片"
          title="收起设备卡片"
          @click="emit('disconnect')"
        >
          <span class="material-symbols-rounded" aria-hidden="true">close</span>
        </button>
      </div>
    </header>

    <div class="device-divider"></div>

    <div ref="filesRef" class="device-files">
      <div class="device-section-title">
        <span>设备文件</span>
        <small>{{ files.length }} 个</small>
      </div>

      <div v-if="canGoBack" class="device-folder-bar">
        <button
          class="device-folder-back"
          type="button"
          title="返回上一级"
          aria-label="返回上一级"
          @click="emit('goBack')"
        >
          <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
        </button>
        <span class="device-folder-label">
          <span class="device-folder-root">U 盘</span>
          <span class="device-folder-sep">/</span>
          <strong>{{ folderName }}</strong>
        </span>
      </div>

      <div class="drag-tip">
        <span class="material-symbols-rounded" aria-hidden="true">drag_indicator</span>
        {{ folderName ? "把文件夹里的文件拖到左侧桌面文件区即可放入桌面" : "拖到左侧桌面文件区即可放入桌面" }}
      </div>

      <div v-if="loading" class="device-file skeleton">
        <span class="device-file-icon skeleton-icon"></span>
        <span class="device-file-info">
          <span class="skeleton-line"></span>
          <span class="skeleton-line short"></span>
        </span>
      </div>

      <div v-else-if="!files.length" class="device-empty">
        <span class="material-symbols-rounded" aria-hidden="true">folder_off</span>
        <span>{{ folderName ? "这个文件夹里没有文件" : "设备里没有可读取的文件" }}</span>
      </div>

      <template v-else>
        <button
          v-for="file in files"
          :key="file.path || file.name"
          class="device-file"
          type="button"
          :class="{ 'is-dragging': isDraggingFile(file) }"
          @pointerdown="startFileDrag($event, file)"
          @click="emit('openFile', file)"
        >
          <span class="device-file-icon">
            <span class="material-symbols-rounded" aria-hidden="true">
              {{ fileSymbol(file.ext, file.isDir) }}
            </span>
          </span>
          <span class="device-file-info">
            <strong>{{ file.name }}</strong>
            <small>{{ subtitle(file) }}</small>
          </span>
          <span class="drag-handle material-symbols-rounded" aria-hidden="true">
            drag_indicator
          </span>
        </button>
      </template>
    </div>

    <footer class="device-footer">
      <span class="connection-dot"></span>
      <span>U 盘已就绪</span>
      <button
        class="eject-button"
        type="button"
        :disabled="ejecting"
        @click="emit('eject')"
      >
        <span
          class="material-symbols-rounded"
          :class="{ spinning: ejecting }"
          aria-hidden="true"
        >
          eject
        </span>
        {{ ejecting ? "弹出中…" : "弹出 U 盘" }}
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.device-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 24px 20px 20px;
  border: 1px solid var(--border-subtle);
  border-radius: 30px;
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
  opacity: 0;
  pointer-events: none;
  transform: translateX(calc(100% + 48px));
  transition:
    transform 640ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 300ms ease,
    box-shadow 220ms ease;
}

.device-card.connected {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

.device-card.dragging {
  box-shadow: var(--shadow-card-dragging);
}

.device-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.device-card.dragging .device-header {
  cursor: grabbing;
}

.device-symbol {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 17px;
  background: var(--surface-inner);
  color: var(--accent);
}

.device-symbol .material-symbols-rounded {
  font-size: 25px;
}

.device-title {
  flex: 1;
  min-width: 0;
}

.device-eyebrow {
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.12em;
}

.device-title h2 {
  margin: 4px 0 2px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 680;
  letter-spacing: -0.2px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-title span {
  display: block;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.device-action {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background 180ms ease,
    color 180ms ease;
}

.device-action:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.device-action:disabled {
  opacity: 0.5;
  cursor: default;
}

.device-action .material-symbols-rounded {
  font-size: 19px;
}

.device-action:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 1px;
}

.spinning {
  animation: spin 900ms linear infinite;
}

.device-divider {
  height: 1px;
  flex-shrink: 0;
  margin: 18px 0 14px;
  background: var(--border-subtle);
}

.device-files {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.device-section-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 7px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 650;
}

.device-section-title small {
  font-size: 10px;
  font-weight: 500;
}

.device-folder-bar {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
  min-width: 0;
}

.device-folder-back {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--surface-inner);
  color: var(--text-primary);
  cursor: pointer;
  transition: background 160ms ease;
}

.device-folder-back:hover {
  background: var(--surface-hover);
}

.device-folder-back .material-symbols-rounded {
  font-size: 17px;
}

.device-folder-label {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 10px;
  white-space: nowrap;
}

.device-folder-root {
  flex-shrink: 0;
}

.device-folder-sep {
  flex-shrink: 0;
  opacity: 0.6;
}

.device-folder-label strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 650;
  text-overflow: ellipsis;
}

.drag-tip {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
  color: var(--text-secondary);
  font-size: 9px;
  line-height: 1.4;
}

.drag-tip .material-symbols-rounded {
  font-size: 15px;
}

.device-file {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 10px;
  padding: 9px 7px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: grab;
  transition:
    background 160ms ease,
    opacity 160ms ease;
}

.device-file:hover {
  background: var(--surface-hover);
}

.device-file:active {
  cursor: grabbing;
}

.device-file.is-dragging {
  opacity: 0.45;
}

.device-file-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 11px;
  background: var(--surface-inner);
  color: var(--accent);
}

.device-file-icon .material-symbols-rounded {
  font-size: 19px;
}

.device-file-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.device-file-info strong {
  overflow: hidden;
  font-size: 11px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-file-info small {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drag-handle {
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 17px;
  opacity: 0.5;
}

.device-empty {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 18px 6px;
  color: var(--text-secondary);
  font-size: 10px;
  pointer-events: none;
}

.device-empty .material-symbols-rounded {
  font-size: 20px;
}

.device-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 10px;
}

.connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 16%, transparent);
}

.eject-button {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 5px 9px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.eject-button:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.eject-button:disabled {
  opacity: 0.55;
  cursor: default;
}

.eject-button .material-symbols-rounded {
  font-size: 15px;
}

.skeleton {
  pointer-events: none;
}

.skeleton-icon,
.skeleton-line {
  background: var(--surface-inner);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-line {
  display: block;
  width: 100%;
  height: 9px;
  border-radius: 999px;
}

.skeleton-line.short {
  width: 55%;
  height: 7px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

@media (prefers-reduced-motion: reduce) {
  .device-card {
    transition-duration: 1ms;
  }

  .spinning {
    animation-duration: 1ms;
  }
}
</style>
