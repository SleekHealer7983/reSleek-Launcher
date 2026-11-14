import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppEntry, DriveEntry, FileEntry } from "../types";

export const isDesktop = isTauri();

export async function fetchApps(force = false): Promise<AppEntry[]> {
  if (!isDesktop) return [];
  return invoke<AppEntry[]>("list_apps", { force });
}

export async function launchApp(appId?: string, target?: string | null) {
  if (!isDesktop || !appId) return;
  await invoke("launch_app", { appId, target: target ?? null });
}

export async function openSpecial(kind: "this-pc" | "recycle-bin") {
  if (!isDesktop) return;
  await invoke("open_special", { kind });
}

export async function fetchDesktopFiles(): Promise<FileEntry[]> {
  if (!isDesktop) return [];
  return invoke<FileEntry[]>("list_desktop_files");
}

export async function fetchRemovableDrives(): Promise<DriveEntry[]> {
  if (!isDesktop) return [];
  return invoke<DriveEntry[]>("list_removable_drives");
}

export async function fetchDriveFiles(root: string): Promise<FileEntry[]> {
  if (!isDesktop) return [];
  return invoke<FileEntry[]>("list_drive_files", { root });
}

export async function fetchFolderFiles(path: string): Promise<FileEntry[]> {
  if (!isDesktop) return [];
  return invoke<FileEntry[]>("list_folder_files", { path });
}

export async function ejectDrive(letter: string) {
  if (!isDesktop) {
    throw new Error("浏览器预览不支持弹出真实设备");
  }
  await invoke("eject_drive", { letter });
}

export async function copyFileToDesktop(path: string): Promise<FileEntry> {
  if (!isDesktop) {
    throw new Error("浏览器预览不会复制真实文件");
  }
  return invoke<FileEntry>("copy_to_desktop", { source: path });
}

export async function openPath(path: string) {
  if (!isDesktop || !path) return;
  await invoke("open_path", { path });
}

export async function recyclePath(path: string) {
  if (!isDesktop) {
    throw new Error("浏览器预览不会移动真实文件");
  }
  await invoke("recycle_path", { path });
}
