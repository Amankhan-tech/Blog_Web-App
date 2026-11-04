// Single place for the backend address. Set REACT_APP_API_URL in client/.env
// to point the app at a different server (e.g. when deployed).
export const API_URL = (process.env.REACT_APP_API_URL || "http://localhost:4000").replace(/\/+$/, "");

// Full URL for an uploaded cover image stored as "uploads/<file>".
export const imageUrl = (cover) => (cover ? `${API_URL}/${cover}` : "");

// fetch() wrapper: always sends the login cookie, parses JSON, and turns
// server errors into a readable message. Resolves to { ok, status, data, error }.
export async function apiFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { credentials: "include", ...options });
  } catch {
    return { ok: false, status: 0, data: null, error: "Can't reach the server. Is it running?" };
  }
  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? "" : data?.error || `Request failed (${response.status})`,
  };
}

export const postJson = (path, body) =>
  apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
