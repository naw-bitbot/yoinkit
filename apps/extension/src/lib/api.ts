const API_BASE = "http://127.0.0.1:9271";

interface DownloadRequest {
  url: string;
  flags?: Record<string, unknown>;
  save_path?: string;
}

interface HealthResponse {
  status: string;
  app: string;
  version: string;
}

async function getAuthToken(): Promise<string> {
  const result = await chrome.storage.local.get("auth_token");
  return result.auth_token || "";
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  health: () => apiRequest<HealthResponse>("/health"),

  startDownload: (req: DownloadRequest) =>
    apiRequest<{ id: string }>("/download", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  getDownloads: () =>
    apiRequest<Array<Record<string, unknown>>>("/downloads"),

  getSettings: () =>
    apiRequest<Record<string, unknown>>("/settings"),

  updateSettings: (settings: Record<string, unknown>) =>
    apiRequest<void>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};
