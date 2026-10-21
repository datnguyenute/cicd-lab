const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// Gửi Firebase ID token qua header Authorization để backend verify
export async function apiFetch<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}
