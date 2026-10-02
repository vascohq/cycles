'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { UI_PREF_COOKIES } from '@/lib/ui-pref-cookies'

/**
 * Per-viewer layout choices: is the section sidebar closed, is the frame list
 * hidden. They live in cookies, not localStorage, because the server must
 * read them: rendered open and then closed after load, the sidebar flickers.
 * The [slug] layout reads the cookies and seeds this provider.
 */
export type UiPrefs = { sidebarClosed: boolean; framesHidden: boolean }

type Ctx = { prefs: UiPrefs; set: (key: keyof UiPrefs, value: boolean) => void }
const UiPrefsContext = createContext<Ctx | null>(null)

export function UiPrefsProvider({ initial, children }: { initial: UiPrefs; children: ReactNode }) {
  const [prefs, setPrefs] = useState(initial)
  const set = useCallback((key: keyof UiPrefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }))
    document.cookie = `${UI_PREF_COOKIES[key]}=${value ? 1 : 0}; path=/; max-age=31536000; samesite=lax`
  }, [])
  return <UiPrefsContext.Provider value={{ prefs, set }}>{children}</UiPrefsContext.Provider>
}

/**
 * One layout choice and its setter. Outside the provider (e2e fixtures, tests,
 * Storybook) it is plain local state that starts false.
 */
export function useUiPref(key: keyof UiPrefs): [boolean, (value: boolean) => void] {
  const ctx = useContext(UiPrefsContext)
  const [local, setLocal] = useState(false)
  if (!ctx) return [local, setLocal]
  return [ctx.prefs[key], (value) => ctx.set(key, value)]
}
