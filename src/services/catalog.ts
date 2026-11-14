import type { AppEntry, LauncherApp } from "../types";

const IGNORED =
  /(^|[\s._-])(uninstall|readme|license|release notes|documentation|help|setup)([\s._-]|$)|卸载|许可协议|帮助文档|用户手册/i;

const WHITEBOARD = /希沃|seewo|白板|whiteboard|easinote|maxhub|鸿合|smart notebook|授课/i;

const SYSTEM_NAME =
  /^(设置|控制面板|任务管理器|计算机管理|系统配置|系统信息|事件查看器|服务|性能监视器|资源监视器|任务计划程序|组件服务|本地安全策略|高级安全 Windows Defender 防火墙|磁盘清理|打印管理|步骤记录器|放大镜|讲述人|屏幕键盘|语音访问|字符映射表|远程桌面连接|运行|碎片整理和优化驱动器|恢复驱动器|注册表编辑器|命令提示符|终端|Windows PowerShell.*|Windows App Cert Kit|Application Verifier.*|Windows Media Player Legacy|Windows 安全中心|Windows 更新|入门|反馈中心|手机连接|文件资源管理器|截图工具|画图|计算器|时钟|相机|照片|记事本|录音机|媒体播放器|便笺|地图|天气|XBOX|Microsoft Store|应用商店)$/i;

const SYSTEM_TARGET = /^[A-Za-z]:\\Windows\\/i;

const SYSTEM_APP_ID =
  /^(Microsoft\.Windows(\.|$)|MicrosoftWindows\.|windows\.|Microsoft\.Microsoft|Microsoft\.GamingApp|Microsoft\.Paint|Microsoft\.ScreenSketch|Microsoft\.ZuneMusic|Microsoft\.YourPhone|Microsoft\.WindowsFeedbackHub|Microsoft\.CommandPalette|Microsoft\.WindowsTerminal|Microsoft\.WindowsNotepad|Microsoft\.WindowsCalculator|Microsoft\.WindowsCamera|Microsoft\.WindowsSoundRecorder|Microsoft\.WindowsAlarms|Microsoft\.Windows\.|Microsoft\.Windows\.Explorer|Microsoft\.Windows\.ControlPanel|Microsoft\.Windows\.Shell\.|Microsoft\.Windows\.RemoteDesktop)/i;

export const SPECIAL_APPS: LauncherApp[] = [
  {
    id: "special:this-pc",
    name: "此电脑",
    symbol: "computer",
    special: "this-pc",
    featured: true,
    tone: 0,
  },
  {
    id: "special:recycle-bin",
    name: "回收站",
    symbol: "delete",
    special: "recycle-bin",
    featured: true,
    tone: 2,
  },
];

function hashTone(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash + name.charCodeAt(index) * (index + 7)) % 997;
  }
  return hash % 5;
}

function symbolForApp(name: string): string | undefined {
  if (/edge|chrome|firefox|browser|浏览器/i.test(name)) return "public";
  if (/文件|explorer|资源管理器/i.test(name)) return "folder";
  if (/设置|settings|控制面板/i.test(name)) return "settings";
  if (WHITEBOARD.test(name)) return "draw";
  if (/投屏|投影|cast/i.test(name)) return "cast";
  if (/课堂|授课|school|学生|教师/i.test(name)) return "school";
  if (/商店|store|应用中心/i.test(name)) return "storefront";
  if (/微信|企业微信|qq|chat|聊天|钉钉|飞书/i.test(name)) return "chat";
  if (/音乐|music|网易云|spotify/i.test(name)) return "music_note";
  if (/视频|video|播放|player|potplayer|vlc|bilibili/i.test(name)) return "play_circle";
  if (/office|word|excel|powerpoint|wps|pdf/i.test(name)) return "description";
  if (/steam|game|游戏/i.test(name)) return "sports_esports";
  if (/terminal|cmd|powershell|命令/i.test(name)) return "terminal";
  if (/计算器|calculator/i.test(name)) return "calculate";
  if (/相机|camera/i.test(name)) return "photo_camera";
  if (/邮件|mail|outlook/i.test(name)) return "mail";
  if (/下载|download/i.test(name)) return "download";
  if (/压缩|7-zip|winrar|bandizip/i.test(name)) return "archive";
  if (/chatgpt|copilot|\bai\b/i.test(name)) return "smart_toy";
  return undefined;
}

function toLauncherApp(entry: AppEntry): LauncherApp {
  const key = entry.target || entry.appId || entry.name;
  return {
    id: `app:${key}`,
    name: entry.name,
    appId: entry.appId,
    target: entry.target ?? null,
    icon: entry.icon ?? null,
    symbol: symbolForApp(entry.name),
    tone: hashTone(entry.name),
  };
}

function uniqueByName(entries: AppEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isSystemApp(entry: AppEntry) {
  if (SYSTEM_APP_ID.test(entry.appId)) return true;
  if (entry.target && SYSTEM_TARGET.test(entry.target)) return true;
  return SYSTEM_NAME.test(entry.name.trim());
}

function matchesEdge(app: LauncherApp) {
  return (
    /msedge\.exe$/i.test(app.target ?? "") ||
    /microsoft\s*edge/i.test(app.name) ||
    /^edge$/i.test(app.name)
  );
}

export interface CatalogOptions {
  showSystemApps?: boolean;
  pinnedApps?: string[];
  appOrder?: string[];
  hiddenApps?: string[];
}

export function buildCatalog(
  entries: AppEntry[],
  launchCounts: Record<string, number>,
  options: CatalogOptions = {},
): LauncherApp[] {
  const usable = uniqueByName(entries).filter((entry) => {
    if (!entry.name.trim()) return false;
    if (IGNORED.test(entry.name)) return false;
    if (!options.showSystemApps && isSystemApp(entry)) return false;
    if (entry.target && /\.(chm|hlp|txt|pdf|url|htm|html)$/i.test(entry.target)) {
      return false;
    }
    return true;
  });

  const apps = usable
    .map(toLauncherApp)
    .filter((app) => !options.hiddenApps?.includes(app.id));
  const whiteboardCandidates = apps.filter((app) => WHITEBOARD.test(app.name));
  const whiteboard =
    whiteboardCandidates.find((app) => /希沃白板\s*5/i.test(app.name)) ??
    whiteboardCandidates.find((app) => /希沃|seewo|easinote/i.test(app.name)) ??
    whiteboardCandidates[0];
  const edge = apps.find(matchesEdge);

  const pinnedKeys = options.pinnedApps ?? ["edge", "whiteboard"];
  const pinned: LauncherApp[] = [];
  const used = new Set<string>();

  for (const key of pinnedKeys) {
    const app =
      key === "edge"
        ? edge
        : key === "whiteboard"
          ? whiteboard
          : apps.find((candidate) => candidate.id === key);

    if (!app || used.has(app.id)) continue;
    app.featured = true;
    app.pinnedKey = key;
    used.add(app.id);
    pinned.push(app);
  }

  const featured = [...SPECIAL_APPS, ...pinned];
  const featuredIds = new Set(featured.map((app) => app.id));
  const orderIndex = new Map(
    (options.appOrder ?? []).map((id, index) => [id, index]),
  );

  const rest = apps
    .filter((app) => !featuredIds.has(app.id))
    .sort((a, b) => {
      const aIndex = orderIndex.get(a.id);
      const bIndex = orderIndex.get(b.id);
      if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
      if (aIndex !== undefined) return -1;
      if (bIndex !== undefined) return 1;

      const countDiff = (launchCounts[b.id] ?? 0) - (launchCounts[a.id] ?? 0);
      if (countDiff !== 0) return countDiff;
      return a.name.localeCompare(b.name, "zh-CN");
    });

  return [...featured, ...rest];
}
