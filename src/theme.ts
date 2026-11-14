import { applyScheme, createScheme, tonalSpot } from "material/theme";
import { settings } from "./settings";

export const DEFAULT_SEED = "#6750A4";

export interface ThemePreset {
  name: string;
  seed: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: "紫罗兰（默认）", seed: "#6750A4" },
  { name: "湖水蓝", seed: "#0061A4" },
  { name: "森林绿", seed: "#006E1C" },
  { name: "玫瑰灰", seed: "#7D5260" },
];

export interface SwatchPreview {
  lightPrimary: string;
  lightSecondary: string;
  darkPrimary: string;
  darkSecondary: string;
}

export function argbToHex(argb: number) {
  return `#${(argb >>> 0).toString(16).padStart(8, "0").slice(2)}`;
}

export function createThemeScheme(seed: string, dark: boolean) {
  return createScheme(seed, {
    variant: tonalSpot,
    mode: dark ? "dark" : "light",
  });
}

export function previewTheme(seed: string): SwatchPreview {
  const light = createThemeScheme(seed, false);
  const dark = createThemeScheme(seed, true);
  return {
    lightPrimary: argbToHex(light.primaryContainer),
    lightSecondary: argbToHex(light.secondaryContainer),
    darkPrimary: argbToHex(dark.primaryContainer),
    darkSecondary: argbToHex(dark.secondaryContainer),
  };
}

export function applyTheme() {
  const root = document.documentElement;
  const scheme = createThemeScheme(settings.seed, settings.dark);
  applyScheme(scheme, root, { prefix: "mtrl" });

  const token = (role: string) =>
    root.style.getPropertyValue(`--mtrl-sys-color-${role}`).trim();

  const surface = token("surface");
  const surfaceContainerLowest = token("surface-container-lowest");
  const surfaceContainerLow = token("surface-container-low");
  const surfaceContainer = token("surface-container");
  const surfaceContainerHigh = token("surface-container-high");
  const surfaceContainerHighest = token("surface-container-highest");
  const onSurface = token("on-surface");
  const onSurfaceVariant = token("on-surface-variant");
  const primary = token("primary");
  const primaryContainer = token("primary-container");
  const onPrimaryContainer = token("on-primary-container");
  const secondaryContainer = token("secondary-container");
  const onSecondaryContainer = token("on-secondary-container");
  const tertiaryContainer = token("tertiary-container");
  const onTertiaryContainer = token("on-tertiary-container");
  const outlineVariant = token("outline-variant");
  const success = token("success");

  const dark = settings.dark;
  const page = dark ? surface : surfaceContainerLow;
  const card = dark ? surfaceContainer : surfaceContainerLowest;

  root.style.setProperty("--page-background", page);
  root.style.setProperty("--surface-card", card);
  root.style.setProperty(
    "--surface-elevated",
    dark ? surfaceContainerHigh : surfaceContainerLow,
  );
  root.style.setProperty(
    "--surface-inner",
    dark ? surfaceContainerHigh : surfaceContainer,
  );
  root.style.setProperty(
    "--surface-hover",
    dark ? surfaceContainerHighest : surfaceContainerHigh,
  );

  root.style.setProperty("--text-primary", onSurface);
  root.style.setProperty("--text-secondary", onSurfaceVariant);
  root.style.setProperty("--accent", primary);
  root.style.setProperty("--accent-container", secondaryContainer);
  root.style.setProperty("--on-accent-container", onSecondaryContainer);
  root.style.setProperty(
    "--border-subtle",
    `color-mix(in srgb, ${outlineVariant} 55%, transparent)`,
  );
  root.style.setProperty(
    "--focus-ring",
    `color-mix(in srgb, ${primary} 55%, transparent)`,
  );
  root.style.setProperty("--success", success || "#43866b");
  root.style.setProperty(
    "--shadow-card",
    dark
      ? "0 1px 2px rgba(0, 0, 0, .48), 0 12px 32px rgba(0, 0, 0, .38)"
      : "0 1px 2px rgba(48, 33, 64, .06), 0 10px 30px rgba(48, 33, 64, .08)",
  );
  root.style.setProperty(
    "--shadow-card-dragging",
    dark
      ? "0 2px 8px rgba(0, 0, 0, .55), 0 24px 52px rgba(0, 0, 0, .5)"
      : "0 2px 6px rgba(48, 33, 64, .1), 0 22px 48px rgba(48, 33, 64, .16)",
  );

  root.style.setProperty("--tone-primary-bg", primaryContainer);
  root.style.setProperty("--tone-primary-ink", onPrimaryContainer);
  root.style.setProperty("--tone-secondary-bg", secondaryContainer);
  root.style.setProperty("--tone-secondary-ink", onSecondaryContainer);
  root.style.setProperty("--tone-tertiary-bg", tertiaryContainer);
  root.style.setProperty("--tone-tertiary-ink", onTertiaryContainer);
  root.style.setProperty("--tone-neutral-bg", surfaceContainerHigh);
  root.style.setProperty("--tone-neutral-ink", onSurface);
  root.style.setProperty(
    "--tone-tinted-bg",
    `color-mix(in srgb, ${primaryContainer} 55%, ${surfaceContainer})`,
  );
  root.style.setProperty("--tone-tinted-ink", onPrimaryContainer);

  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
}
