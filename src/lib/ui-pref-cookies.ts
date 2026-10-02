/**
 * Cookie names for the per-viewer layout choices (see components/ui-prefs).
 * A plain module, because the [slug] layout reads them on the server and a
 * value exported from a client module is only a reference there.
 */
export const UI_PREF_COOKIES = {
  sidebarClosed: 'ui-sidebar-closed',
  framesHidden: 'ui-frames-hidden',
} as const
