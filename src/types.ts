export type PageId = "desktop" | "settings";

export type SpecialId = "this-pc" | "recycle-bin";

export interface AppEntry {
  name: string;
  appId: string;
  target?: string | null;
  icon?: string | null;
}

export interface LauncherApp {
  id: string;
  name: string;
  appId?: string;
  target?: string | null;
  icon?: string | null;
  symbol?: string;
  special?: SpecialId;
  featured?: boolean;
  whiteboard?: boolean;
  pinnedKey?: string;
  tone: number;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  ext: string;
  size: number;
}

export interface DriveEntry {
  letter: string;
  label: string;
  total: number;
  free: number;
}

export interface DroppedDeviceFile {
  name: string;
  path?: string;
  isDir?: boolean;
  ext?: string;
  size?: number;
  type: string;
  icon: string;
}
