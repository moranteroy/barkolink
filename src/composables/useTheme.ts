import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const savedMode = (typeof window !== 'undefined' ? window.localStorage.getItem('barkolink-theme') : null) as ThemeMode | null
const mode = ref<ThemeMode>(savedMode === 'light' || savedMode === 'dark' || savedMode === 'system' ? savedMode : 'system')
let mediaQuery: MediaQueryList | undefined

function applyTheme() {
  if (typeof document === 'undefined') return
  const resolved = mode.value === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode.value
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
}

export function initializeTheme() {
  if (typeof window === 'undefined') return
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', applyTheme)
  applyTheme()
}

export function useTheme() {
  function setMode(nextMode: ThemeMode) {
    mode.value = nextMode
    window.localStorage.setItem('barkolink-theme', nextMode)
    applyTheme()
  }

  watch(mode, applyTheme)
  return { mode, setMode }
}
