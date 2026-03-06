const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

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

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...config.headers,
    };

    const response = await fetch(this.buildUrl(endpoint, params), {
      ...fetchConfig,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
      }
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
