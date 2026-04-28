/** Base URL for `/instruct_photos/*` (same host as API in prod; Vite proxy in dev). */
export function instructPhotoUrl(filename: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, '')
  return `${base}/instruct_photos/${filename.replace(/^\//, '')}`
}
