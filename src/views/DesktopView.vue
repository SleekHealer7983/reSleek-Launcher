<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import DesktopCard from "../components/DesktopCard.vue";
import DeviceCard from "../components/DeviceCard.vue";
import WowDialog from "../components/WowDialog.vue";
import { buildCatalog } from "../services/catalog";
import { fileSymbol } from "../lib/files";
import { settings } from "../settings";
import {
  DEMO_APPS,
  DEMO_DESKTOP_FILES,
  DEMO_DEVICE_FILES,
  DEMO_DEVICE_FOLDERS,
  DEMO_DRIVE,
} from "../data/demo";
import {
  copyFileToDesktop,
  ejectDrive,
  fetchApps,
  fetchDesktopFiles,
  fetchDriveFiles,
  fetchFolderFiles,
  fetchRemovableDrives,
  isDesktop,
  launchApp,
  openPath,
  openSpecial,
  recyclePath,
} from "../services/backend";
import type {
  AppEntry,
  DroppedDeviceFile,
  DriveEntry,
  FileEntry,
  LauncherApp,
} from "../types";

const APPS_CACHE_KEY = "resleek.apps.v3";
const COUNTS_KEY = "resleek.launchCounts.v1";

const apps = ref<LauncherApp[]>([]);
const appsLoading = ref(true);
const rawApps = ref<AppEntry[]>([]);
const desktopFiles = ref<FileEntry[]>([]);
const filesLoading = ref(true);
const device = ref<DriveEntry | null>(null);
const deviceFiles = ref<FileEntry[]>([]);
const deviceFolderStack = ref<{ path: string; name: string }[]>([]);
const deviceLoading = ref(false);
const ejecting = ref(false);
const dismissedDrive = ref<string | null>(null);
const notice = ref("");
const showWowDialog = ref(false);
const wowTarget = ref<{
  name: string;
  symbol: string;
  icon?: string | null;
  image?: string | null;
} | null>(null);
const clickHistory = new Map<string, number[]>();
let lastFolderNavigation = 0;

const launchCounts = ref<Record<string, number>>(loadCounts());
let driveTimer: ReturnType<typeof setInterval> | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let lastAppsRefresh = Date.now();

const hasDevice = computed(() => Boolean(device.value));
const deviceFolder = computed(
  () => deviceFolderStack.value[deviceFolderStack.value.length - 1] ?? null,
);

function loadCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COUNTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveCounts() {
  try {
    localStorage.setItem(COUNTS_KEY, JSON.stringify(launchCounts.value));
  } catch {
    // Frequency sorting is optional.
  }
}

function rebuildApps() {
  apps.value = buildCatalog(rawApps.value, launchCounts.value, {
    showSystemApps: settings.showSystemApps,
    pinnedApps: settings.pinnedApps,
    appOrder: settings.appOrder,
    hiddenApps: settings.hiddenApps,
  });
}

function readAppsCache(): AppEntry[] {
  try {
    const raw = localStorage.getItem(APPS_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AppEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAppsCache(entries: AppEntry[]) {
  try {
    localStorage.setItem(APPS_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // The icon payload can be large; a failed cache should not block the launcher.
  }
}

function showNotice(message: string) {
  notice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = "";
  }, 2200);
}

function bumpLaunch(app: LauncherApp) {
  launchCounts.value[app.id] = (launchCounts.value[app.id] ?? 0) + 1;
  saveCounts();
  rebuildApps();
}

async function refreshApps(force = false) {
  if (!isDesktop) {
    rawApps.value = appsToEntries();
    rebuildApps();
    appsLoading.value = false;
    return;
  }

  if (!apps.value.length) appsLoading.value = true;
  try {
    const entries = await fetchApps(force);
    rawApps.value = entries;
    rebuildApps();
    writeAppsCache(entries);
  } catch (error) {
    console.error(error);
    if (!rawApps.value.length) {
      apps.value = [];
      showNotice("读取应用列表失败");
    }
  } finally {
    appsLoading.value = false;
  }
}

function appsToEntries(): AppEntry[] {
  return DEMO_APPS.map((app) => ({
    name: app.name,
    appId: app.id,
  }));
}

async function refreshDesktopFiles() {
  if (!isDesktop) {
    desktopFiles.value = DEMO_DESKTOP_FILES;
    filesLoading.value = false;
    return;
  }

  try {
    desktopFiles.value = await fetchDesktopFiles();
  } catch (error) {
    console.error(error);
    showNotice("读取桌面文件失败");
  } finally {
    filesLoading.value = false;
  }
}

async function loadDeviceFiles() {
  if (!device.value) {
    deviceFiles.value = [];
    return;
  }

  deviceLoading.value = true;
  try {
    if (!isDesktop) {
      deviceFiles.value = deviceFolder.value
        ? DEMO_DEVICE_FOLDERS[deviceFolder.value.name] ?? []
        : DEMO_DEVICE_FILES;
      return;
    }

    const folder = deviceFolder.value;
    deviceFiles.value = folder
      ? await fetchFolderFiles(folder.path)
      : await fetchDriveFiles(`${device.value.letter}\\`);
  } catch (error) {
    console.error(error);
    deviceFiles.value = [];
    if (deviceFolder.value) showNotice("无法读取这个文件夹");
  } finally {
    deviceLoading.value = false;
  }
}

async function refreshDevices() {
  if (!isDesktop) {
    if (dismissedDrive.value === DEMO_DRIVE.letter) {
      device.value = null;
      deviceFiles.value = [];
      deviceFolderStack.value = [];
      return;
    }
    device.value = DEMO_DRIVE;
    deviceFiles.value = deviceFolder.value
      ? DEMO_DEVICE_FOLDERS[deviceFolder.value.name] ?? []
      : DEMO_DEVICE_FILES;
    return;
  }

  try {
    const drives = await fetchRemovableDrives();
    if (!drives.length) {
      device.value = null;
      deviceFiles.value = [];
      deviceFolderStack.value = [];
      dismissedDrive.value = null;
      return;
    }

    if (
      dismissedDrive.value &&
      !drives.some((drive) => drive.letter === dismissedDrive.value)
    ) {
      dismissedDrive.value = null;
    }

    const next = drives.find((drive) => drive.letter !== dismissedDrive.value);
    if (!next) {
      device.value = null;
      deviceFiles.value = [];
      deviceFolderStack.value = [];
      return;
    }

    const changed = device.value?.letter !== next.letter;
    device.value = next;
    if (changed) {
      deviceFolderStack.value = [];
      await loadDeviceFiles();
    }
  } catch (error) {
    console.error(error);
  }
}

async function refreshDeviceFiles() {
  await loadDeviceFiles();
}

function dismissDevice() {
  dismissedDrive.value = device.value?.letter ?? null;
  device.value = null;
  deviceFiles.value = [];
  deviceFolderStack.value = [];
}

async function handleEjectDevice() {
  if (!device.value || ejecting.value) return;

  if (!isDesktop) {
    dismissDevice();
    showNotice("U 盘已弹出（浏览器预览）");
    return;
  }

  const letter = device.value.letter;
  ejecting.value = true;
  try {
    await ejectDrive(letter);
    showNotice(`已发送弹出请求：${letter}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await refreshDevices();
    if (device.value?.letter === letter) {
      showNotice("已发送弹出请求，请在系统提示中确认安全移除");
    } else {
      showNotice(`${letter} 已安全移除`);
    }
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    showNotice(`弹出 ${letter} 失败：${message}`);
  } finally {
    ejecting.value = false;
  }
}

async function handleOpenDeviceFile(file: FileEntry) {
  if (file.isDir) {
    const now = Date.now();
    if (now - lastFolderNavigation < 350) return;
    lastFolderNavigation = now;
    deviceFolderStack.value.push({ path: file.path, name: file.name });
    await refreshDeviceFiles();
    return;
  }

  await handleOpenFile(file);
}

async function handleDeviceBack() {
  if (!deviceFolderStack.value.length) return;
  deviceFolderStack.value.pop();
  await refreshDeviceFiles();
}

function handleTogglePin(app: LauncherApp) {
  if (app.special) return;
  const keys = [...settings.pinnedApps];
  const key = app.pinnedKey ?? app.id;
  const index = keys.indexOf(key);
  if (index >= 0) keys.splice(index, 1);
  else keys.push(key);
  settings.pinnedApps = keys;
  rebuildApps();
}

function handleReorderApps(sourceId: string, targetId: string) {
  const ids = apps.value.filter((app) => !app.featured).map((app) => app.id);
  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  settings.appOrder = ids;
  rebuildApps();
}

async function refreshAll() {
  await Promise.all([refreshApps(true), refreshDesktopFiles()]);
}

function hideApp(app: LauncherApp) {
  if (settings.hiddenApps.includes(app.id)) return;
  settings.hiddenApps = [...settings.hiddenApps, app.id];
  rebuildApps();
}

function isRapidRepeat(key: string) {
  const now = Date.now();
  const recent = (clickHistory.get(key) ?? []).filter((time) => now - time < 900);
  recent.push(now);
  if (recent.length >= 2) {
    clickHistory.delete(key);
    return true;
  }
  clickHistory.set(key, recent);
  return false;
}

function showWow(target: {
  name: string;
  symbol: string;
  icon?: string | null;
  image?: string | null;
}) {
  wowTarget.value = target;
  showWowDialog.value = true;
}

async function handleLaunch(app: LauncherApp) {
  if (isRapidRepeat(`app:${app.id}`)) {
    showWow({
      name: app.name,
      symbol: app.symbol ?? "apps",
      icon: app.icon ?? null,
    });
    return;
  }

  try {
    if (app.special) {
      await openSpecial(app.special);
    } else {
      await launchApp(app.appId, app.target);
    }
    bumpLaunch(app);
    if (!isDesktop) showNotice(`${app.name}（浏览器预览）`);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    const remove = window.confirm(
      `无法启动“${app.name}”。\n${message}\n\n是否从启动器移除这个应用？`,
    );
    if (remove) hideApp(app);
    void refreshApps(true);
    void refreshDesktopFiles();
  }
}

async function handleOpenFile(file: FileEntry) {
  const isSleekWow = file.name.toLowerCase() === "sleekwow.png";

  if (isRapidRepeat(`file:${file.path || file.name}`)) {
    showWow({
      name: file.name,
      symbol: fileSymbol(file.ext, file.isDir),
      image: isSleekWow ? "/assets/sleekwow.png" : null,
    });
    return;
  }

  if (isSleekWow) return;

  if (!file.path) {
    showNotice(`${file.name}（浏览器预览）`);
    return;
  }
  try {
    await openPath(file.path);
  } catch (error) {
    console.error(error);
    showNotice(`无法打开 ${file.name}`);
  }
}

async function handleDropDeviceFile(file: DroppedDeviceFile) {
  if (isDesktop && file.path) {
    showNotice(`正在复制 ${file.name}…`);
    try {
      const entry = await copyFileToDesktop(file.path);
      desktopFiles.value = [
        entry,
        ...desktopFiles.value.filter((item) => item.name !== entry.name),
      ];
      showNotice(`已复制 ${entry.name} 到桌面`);
    } catch (error) {
      console.error(error);
      showNotice(`复制 ${file.name} 失败`);
    }
    return;
  }

  const ext = file.ext ?? file.name.split(".").pop()?.toLowerCase() ?? "";
  const entry: FileEntry = {
    name: file.name,
    path: "",
    isDir: Boolean(file.isDir),
    ext,
    size: file.size ?? 0,
  };
  if (!desktopFiles.value.some((item) => item.name === entry.name)) {
    desktopFiles.value = [entry, ...desktopFiles.value];
  }
  showNotice(`已放到桌面文件区（预览）`);
}

async function handleRecycleDeviceFile(file: DroppedDeviceFile) {
  if (isDesktop && file.path) {
    showNotice(`正在移到回收站：${file.name}…`);
    try {
      await recyclePath(file.path);
      showNotice(`已把 ${file.name} 移到回收站`);
      await refreshDeviceFiles();
      await refreshDesktopFiles();
    } catch (error) {
      console.error(error);
      showNotice(`移到回收站失败：${file.name}`);
    }
    return;
  }

  deviceFiles.value = deviceFiles.value.filter((item) => item.name !== file.name);
  showNotice(`已移到回收站（预览）`);
}

async function handleRecycleDesktopFile(file: DroppedDeviceFile) {
  if (isDesktop && file.path) {
    showNotice(`正在移到回收站：${file.name}…`);
    try {
      await recyclePath(file.path);
      showNotice(`已把 ${file.name} 移到回收站`);
      await refreshDesktopFiles();
    } catch (error) {
      console.error(error);
      showNotice(`移到回收站失败：${file.name}`);
    }
    return;
  }

  desktopFiles.value = desktopFiles.value.filter((item) => item.name !== file.name);
  showNotice(`已移到回收站（预览）`);
}

function onWindowFocus() {
  void refreshDesktopFiles();
  void refreshDeviceFiles();
  if (Date.now() - lastAppsRefresh > 12000) {
    lastAppsRefresh = Date.now();
    void refreshApps(true);
  }
}

watch(
  () => [
    settings.showSystemApps,
    settings.pinnedApps.join("|"),
    settings.appOrder.join("|"),
    settings.hiddenApps.join("|"),
  ],
  () => rebuildApps(),
);

onMounted(() => {
  try {
    localStorage.removeItem("resleek.apps.v2");
  } catch {
    // The old cache had incomplete/black icons; the new scan replaces it.
  }

  const cached = readAppsCache();
  if (cached.length) {
    rawApps.value = cached;
    rebuildApps();
    appsLoading.value = false;
  }

  void refreshApps();
  void refreshDesktopFiles();
  void refreshDevices();
  driveTimer = setInterval(() => void refreshDevices(), 3000);
  window.addEventListener("focus", onWindowFocus);
});

onBeforeUnmount(() => {
  if (driveTimer) clearInterval(driveTimer);
  if (noticeTimer) clearTimeout(noticeTimer);
  window.removeEventListener("focus", onWindowFocus);
});
</script>

<template>
  <section
    class="desktop-view"
    :class="{ 'has-device': hasDevice }"
  >
    <div class="desktop-slot">
      <DesktopCard
        :apps="apps"
        :loading="appsLoading"
        :files="desktopFiles"
        :files-loading="filesLoading"
        :notice="notice"
        @launch="handleLaunch"
        @open-file="handleOpenFile"
        @drop-on-desktop="handleDropDeviceFile"
        @recycle-file="handleRecycleDeviceFile"
        @refresh-apps="refreshApps(true)"
        @refresh-all="refreshAll"
        @toggle-pin="handleTogglePin"
        @reorder-apps="handleReorderApps"
        @recycle-desktop-file="handleRecycleDesktopFile"
      />
    </div>

    <div class="device-slot">
      <DeviceCard
        :connected="hasDevice"
        :device="device"
        :files="deviceFiles"
        :loading="deviceLoading"
        :folder-name="deviceFolder?.name ?? ''"
        :can-go-back="deviceFolderStack.length > 0"
        :ejecting="ejecting"
        @disconnect="dismissDevice"
        @open-file="handleOpenDeviceFile"
        @go-back="handleDeviceBack"
        @eject="handleEjectDevice"
        @refresh="refreshDeviceFiles"
        @drop-on-desktop="handleDropDeviceFile"
        @recycle-file="handleRecycleDeviceFile"
      />
    </div>

    <WowDialog
      v-model:open="showWowDialog"
      :name="wowTarget?.name"
      :symbol="wowTarget?.symbol"
      :icon="wowTarget?.icon"
      :image="wowTarget?.image"
    />
  </section>
</template>

<style scoped>
.desktop-view {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.desktop-slot {
  height: 100%;
  min-height: 0;
  margin-right: 0;
  transition: margin-right 620ms cubic-bezier(0.16, 1, 0.3, 1);
}

.has-device .desktop-slot {
  margin-right: 316px;
}

.device-slot {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 300px;
  pointer-events: none;
}

.has-device .device-slot {
  pointer-events: auto;
}

@media (max-width: 980px) {
  .has-device .desktop-slot {
    margin-right: 276px;
  }

  .device-slot {
    width: 260px;
  }
}
</style>
