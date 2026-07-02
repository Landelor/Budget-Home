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

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new ApiError(res.status, "Server returned an empty response — the API may be down");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, "Server returned a non-JSON response — the API may be down");
  }
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

export async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: formData });

  if (res.status === 401) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      const newToken = getToken();
      const retryHeaders: Record<string, string> = {};
      if (newToken) retryHeaders["Authorization"] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${API_BASE}${path}`, { method: "POST", headers: retryHeaders, body: formData });
      if (retryRes.status === 204) return undefined as T;
      const retryData = await readJson<Record<string, string>>(retryRes);
      if (!retryRes.ok) throw new ApiError(retryRes.status, retryData?.message ?? retryData?.error ?? "Upload failed");
      return retryData as T;
    }
    signOut();
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  if (res.status === 204) return undefined as T;
  const data = await readJson<Record<string, string>>(res);
  if (!res.ok) throw new ApiError(res.status, data?.message ?? data?.error ?? "Upload failed");
  return data as T;
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { headers });

  if (res.status === 401) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      const newToken = getToken();
      const retryHeaders: Record<string, string> = {};
      if (newToken) retryHeaders["Authorization"] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${API_BASE}${path}`, { headers: retryHeaders });
      if (!retryRes.ok) throw new ApiError(retryRes.status, "Failed to fetch content");
      return retryRes.blob();
    }
    signOut();
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  if (!res.ok) throw new ApiError(res.status, "Failed to fetch content");
  return res.blob();
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
      const retryData = await readJson<Record<string, string>>(retryRes);
      if (!retryRes.ok) {
        throw new ApiError(retryRes.status, retryData?.message ?? retryData?.error ?? "Request failed");
      }
      return retryData as T;
    }
    signOut();
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  if (res.status === 204) return undefined as T;

  const data = await readJson<Record<string, string>>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? data?.error ?? "Request failed");
  }
  return data as T;
}
