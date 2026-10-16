/** Credentialed, uncached transport. Server callers explicitly forward incoming cookies. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, public body: Record<string, unknown>, message?: string) {
    super(message ?? code)
    this.name = "ApiError"
  }
}

const publicBase = () => (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api").replace(/\/$/, "")
const requestBase = () => typeof window === "undefined" ? (process.env.API_BASE_URL ?? publicBase()).replace(/\/$/, "") : publicBase()
function resolve(path: string, base: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (path === "/api" || path.startsWith("/api/")) return new URL(path, base).toString()
  return `${base}/${path.replace(/^\//, "")}`
}
/** Public media URL, including backend-returned /api/... paths. */
export const resolveApiUrl = (path: string): string => resolve(path, publicBase())
export const apiUrl = resolveApiUrl

export function queryString(values: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null && item !== "") params.append(key, String(item))
    }
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ""
}

async function response(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  if (typeof options.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  if (typeof FormData !== "undefined" && options.body instanceof FormData) headers.delete("Content-Type")
  const res = await fetch(resolve(path, requestBase()), { ...options, headers, credentials: "include", cache: "no-store" })
  if (res.ok) return res
  const raw = await res.text()
  let body: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { detail: parsed }
  } catch { body = { detail: raw } }
  const detail = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : body
  const code = typeof detail.code === "string" ? detail.code : `http_${res.status}`
  const message = typeof detail.message === "string" ? detail.message : res.statusText || "Request failed"
  if (typeof window !== "undefined" && !/\/auth\//.test(new URL(resolve(path, requestBase())).pathname)) {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("preppilot:unauthorized"))
      if (!window.location.pathname.startsWith("/login")) {
        // A full navigation discards stale per-account client state after cookie revocation.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login?reason=session")
      }
    } else if (res.status === 403 && code === "access_expired") {
      window.dispatchEvent(new CustomEvent("preppilot:access-expired"))
    }
  }
  throw new ApiError(res.status, code, body, message)
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await response(path, options)
  if (res.status === 204 || res.status === 205) return undefined as T
  const raw = await res.text()
  return (raw ? JSON.parse(raw) : undefined) as T
}
export async function download(path: string, options: RequestInit = {}): Promise<Blob> {
  return (await response(path, options)).blob()
}

/** Filename from a Content-Disposition header; RFC 5987 `filename*` wins. Path separators are stripped. */
function dispositionFilename(header: string | null): string | null {
  if (!header) return null
  let name: string | null = null
  const extended = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header)
  if (extended) {
    try { name = decodeURIComponent(extended[2].trim().replace(/^"(.*)"$/, "$1")) } catch { name = null }
  }
  if (name === null) {
    const plain = /(?:^|;)\s*filename\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;]+))/i.exec(header)
    if (plain) name = plain[1] !== undefined ? plain[1].replace(/\\(.)/g, "$1") : plain[2].trim()
  }
  const safe = name?.split(/[/\\]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim()
  return safe && safe !== "." && safe !== ".." ? safe : null
}
/** Like `download`, plus the server's Content-Disposition filename (null when absent or not CORS-exposed). */
export async function downloadFile(path: string, options: RequestInit = {}): Promise<{ blob: Blob; filename: string | null }> {
  const res = await response(path, options)
  return { blob: await res.blob(), filename: dispositionFilename(res.headers.get("Content-Disposition")) }
}
