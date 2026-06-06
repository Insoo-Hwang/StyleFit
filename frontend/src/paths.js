const rawBase = import.meta.env.BASE_URL || '/'

export const APP_BASE = rawBase === '/'
  ? ''
  : `/${rawBase.replace(/^\/|\/$/g, '')}`

export function withAppBase(path) {
  if (!path || typeof path !== 'string') return path
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path
  if (!path.startsWith('/')) return path
  if (!APP_BASE || path === APP_BASE || path.startsWith(`${APP_BASE}/`)) return path
  return `${APP_BASE}${path}`
}

export function appOriginPath(path = '') {
  return `${window.location.origin}${withAppBase(path)}`
}
