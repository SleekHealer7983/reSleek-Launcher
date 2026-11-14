import { reactive } from "vue";

export interface AppSettings {
  seed: string;
  dark: boolean;
  fullscreen: boolean;
  customColor: boolean;
  showSystemApps: boolean;
  pinnedApps: string[];
  appOrder: string[];
  hiddenApps: string[];
  backgroundImage: string;
  backgroundBlur: number;
  clockEnabled: boolean;
  clockShowDate: boolean;
  clockShowHoliday: boolean;
  clockShowSeconds: boolean;
  clockShowMilliseconds: boolean;
  clockBackground: boolean;
}

const STORAGE_KEY = "resleek.settings.v1";

const DEFAULT_SETTINGS: AppSettings = {
  seed: "#6750A4",
  dark: false,
  fullscreen: true,
  customColor: false,
  showSystemApps: false,
  pinnedApps: ["edge", "whiteboard"],
  appOrder: [],
  hiddenApps: [],
  backgroundImage: "",
  backgroundBlur: 12,
  clockEnabled: true,
  clockShowDate: true,
  clockShowHoliday: true,
  clockShowSeconds: true,
  clockShowMilliseconds: false,
  clockBackground: true,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      seed: typeof parsed.seed === "string" ? parsed.seed : DEFAULT_SETTINGS.seed,
      dark: Boolean(parsed.dark),
      fullscreen: parsed.fullscreen !== false,
      customColor: Boolean(parsed.customColor),
      showSystemApps: Boolean(parsed.showSystemApps),
      pinnedApps: Array.isArray(parsed.pinnedApps)
        ? parsed.pinnedApps.filter((item): item is string => typeof item === "string")
        : [...DEFAULT_SETTINGS.pinnedApps],
      appOrder: Array.isArray(parsed.appOrder)
        ? parsed.appOrder.filter((item): item is string => typeof item === "string")
        : [],
      hiddenApps: Array.isArray(parsed.hiddenApps)
        ? parsed.hiddenApps.filter((item): item is string => typeof item === "string")
        : [],
      backgroundImage:
        typeof parsed.backgroundImage === "string" ? parsed.backgroundImage : "",
      backgroundBlur:
        typeof parsed.backgroundBlur === "number"
          ? Math.min(40, Math.max(0, parsed.backgroundBlur))
          : DEFAULT_SETTINGS.backgroundBlur,
      clockEnabled: parsed.clockEnabled !== false,
      clockShowDate: parsed.clockShowDate !== false,
      clockShowHoliday: parsed.clockShowHoliday !== false,
      clockShowSeconds: parsed.clockShowSeconds !== false,
      clockShowMilliseconds: Boolean(parsed.clockShowMilliseconds),
      clockBackground: parsed.clockBackground !== false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const settings = reactive<AppSettings>(loadSettings());

export function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Settings are a convenience; a quota/private-mode failure should not break the UI.
  }
}

export function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS);
  saveSettings();
}
