import type { DriveEntry, FileEntry, LauncherApp } from "../types";

export const DEMO_APPS: LauncherApp[] = [
  { id: "demo:browser", name: "浏览器", symbol: "public", tone: 0 },
  { id: "demo:files", name: "文件管理器", symbol: "folder", tone: 1 },
  { id: "demo:settings", name: "设置", symbol: "settings", tone: 2 },
  { id: "demo:whiteboard", name: "白板", symbol: "draw", tone: 3 },
  { id: "demo:cast", name: "投屏", symbol: "cast", tone: 4 },
  { id: "demo:class", name: "课堂工具", symbol: "school", tone: 0 },
  { id: "demo:store", name: "应用中心", symbol: "apps", tone: 1 },
  { id: "demo:media", name: "媒体播放器", symbol: "play_circle", tone: 2 },
];

export const DEMO_DESKTOP_FILES: FileEntry[] = [
  { name: "sleekwow.png", path: "", isDir: false, ext: "png", size: 359_800 },
  { name: "课堂课件.pptx", path: "", isDir: false, ext: "pptx", size: 2_400_000 },
  { name: "学习资料.pdf", path: "", isDir: false, ext: "pdf", size: 1_200_000 },
  { name: "课程笔记.docx", path: "", isDir: false, ext: "docx", size: 56_000 },
  { name: "图片素材.png", path: "", isDir: false, ext: "png", size: 840_000 },
];

export const DEMO_DEVICE_FILES: FileEntry[] = [
  { name: "数学课件.pptx", path: "", isDir: false, ext: "pptx", size: 3_100_000 },
  { name: "实验记录.pdf", path: "", isDir: false, ext: "pdf", size: 980_000 },
  { name: "课堂照片", path: "", isDir: true, ext: "", size: 0 },
  { name: "教学视频.mp4", path: "", isDir: false, ext: "mp4", size: 48_000_000 },
];

export const DEMO_DEVICE_FOLDERS: Record<string, FileEntry[]> = {
  课堂照片: [
    { name: "课堂合影.jpg", path: "", isDir: false, ext: "jpg", size: 2_200_000 },
    { name: "板书细节.png", path: "", isDir: false, ext: "png", size: 1_100_000 },
    { name: "学生作品.jpg", path: "", isDir: false, ext: "jpg", size: 840_000 },
  ],
};

export const DEMO_DRIVE: DriveEntry = {
  letter: "D:",
  label: "课堂 U 盘",
  total: 32 * 1024 * 1024 * 1024,
  free: 18 * 1024 * 1024 * 1024,
};
