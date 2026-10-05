import { ref } from "vue";

export type ThemeMode = "light" | "dark" | "system";

function readSavedMode(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem("barkolink-theme") : null;
  } catch { return null; }
}
const savedMode = readSavedMode();
const mode = ref<ThemeMode>(
  savedMode === "light" || savedMode === "dark" || savedMode === "system"
    ? savedMode
    : "system",
);
let mediaQuery: MediaQueryList | undefined;
const resolvedTheme = ref<"light" | "dark">("light");

function applyTheme() {
  if (typeof document === "undefined") return;
  const resolved =
    mode.value === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode.value;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  resolvedTheme.value = resolved;
  document.documentElement.classList.toggle(
    "ion-palette-dark",
    resolved === "dark",
  );
  document.documentElement.style.colorScheme = resolved;
}

export function initializeTheme() {
  if (typeof window === "undefined") return;
  if (!mediaQuery) {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", applyTheme);
    window.addEventListener("storage", (event) => {
      if (event.key !== "barkolink-theme") return;
      mode.value = event.newValue === "light" || event.newValue === "dark" ? event.newValue : "system";
      applyTheme();
    });
  }
  applyTheme();
}

export function useTheme() {
  function setMode(nextMode: ThemeMode) {
    mode.value = nextMode;
    try { window.localStorage.setItem("barkolink-theme", nextMode); } catch { /* Keep the theme usable without storage. */ }
    applyTheme();
  }

  return { mode, resolvedTheme, setMode };
}
