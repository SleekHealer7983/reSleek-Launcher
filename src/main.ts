import { createApp, watch } from "vue";
import App from "./App.vue";

import "material/styles/base";
import "material/styles/typography";
import "@material-symbols/font-400/rounded.css";
import "./style.css";

import { applyTheme } from "./theme";
import { saveSettings, settings } from "./settings";

applyTheme();

watch(
  () => [settings.seed, settings.dark] as const,
  () => applyTheme(),
  { flush: "post" },
);

let saveTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  settings,
  () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveSettings(), 250);
  },
  { deep: true },
);

createApp(App).mount("#app");
