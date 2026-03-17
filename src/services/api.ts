const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

interface RequestConfig extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {

  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthToken(): string | null {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed?.state?.accessToken || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  private buildUrl(endpoint: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { params, ...fetchConfig } = config;
    const token = this.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.headers as Record<string, string> || {}),
    };

    let response = await fetch(this.buildUrl(endpoint, params), {
      ...fetchConfig,
      headers,
    });

    // Handle 401 Unauthorized - attempt token refresh
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh-token')) {
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          const refreshToken = parsed?.state?.refreshToken;

          if (refreshToken) {
            // Attempt to refresh tokens via the backend
            const refreshRes = await fetch(this.buildUrl('/auth/refresh-token'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              if (refreshData.status && refreshData.object) {
                const { accessToken, idToken } = refreshData.object;

                // Update localStorage
                if (parsed.state) {
                  parsed.state.accessToken = accessToken;
                  parsed.state.idToken = idToken;
                  localStorage.setItem('auth-storage', JSON.stringify(parsed));
                }

                // Retry original request with new token
                headers['Authorization'] = `Bearer ${accessToken}`;
                response = await fetch(this.buildUrl(endpoint, params), {
                  ...fetchConfig,
                  headers,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Token refresh failed', error);
      }

      // If still 401 after refresh attempt, logout
      if (response.status === 401) {
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP Error ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(BASE_URL);
export default api;
