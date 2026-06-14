const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  return localStorage.getItem("accessToken");
}

// Singleton refresh promise to prevent parallel refresh races
let refreshingPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    try {
      const storedRefreshToken = localStorage.getItem("refreshToken");
      if (!storedRefreshToken) return false;

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (!res.ok) return false;

      const { accessToken, refreshToken } = await res.json();
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
}

function signOut(): void {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.dispatchEvent(new Event("auth:expired"));
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && !path.startsWith("/auth/")) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      const newToken = getToken();
      const retryHeaders: Record<string, string> = {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.headers as Record<string, string>),
      };
      if (newToken) retryHeaders["Authorization"] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: retryHeaders,
      });
      if (retryRes.status === 204) return undefined as T;
      const retryData = await retryRes.json();
      if (!retryRes.ok) {
        throw new ApiError(retryRes.status, retryData?.message ?? retryData?.error ?? "Request failed");
      }
      return retryData as T;
    }
    signOut();
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? data?.error ?? "Request failed");
  }
  return data as T;
}
