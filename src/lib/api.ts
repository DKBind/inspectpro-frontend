import { useAuthStore } from '@/store/useAuthStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Helper to get fresh tokens
const getTokens = () => {
  const state = useAuthStore.getState();
  return {
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
  };
};

let isRefreshing = false;
let failedQueue: { resolve: (value?: unknown) => void; reject: (reason?: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data: any = null) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

export const fetchApi = async (
  endpoint: string,
  options: FetchOptions = {}
): Promise<any> => {
  const { requireAuth = true, ...customConfig } = options;
  const { accessToken } = getTokens();

  const headers = new Headers(customConfig.headers || {});

  if (!headers.has('Content-Type') && !(customConfig.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (requireAuth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const config: RequestInit = {
    ...customConfig,
    headers,
  };

  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, config);

    if (response.status === 401 && requireAuth) {
      const { refreshToken } = getTokens();

      if (!refreshToken) {
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        throw new ApiError(401, 'Unauthorized - No refresh token');
      }

      if (isRefreshing) {
        // Queue the request until refresh is done
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            headers.set('Authorization', `Bearer ${token}`);
            return fetch(url, { ...config, headers });
          })
          .then((res: any) => res.json())
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      isRefreshing = true;

      try {
        // Attempt to refresh token
        const refreshResponse = await fetch(`${BASE_URL}/auth/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!refreshResponse.ok) {
          throw new Error('Refresh failed');
        }

        const refreshData = await refreshResponse.json();
        const newAccessToken = refreshData.accessToken;

        // Assuming refresh returns at least a new access token
        useAuthStore.getState().setAccessToken(newAccessToken);

        processQueue(null, newAccessToken);
        isRefreshing = false;

        // Retry original request
        headers.set('Authorization', `Bearer ${newAccessToken}`);
        const retryResponse = await fetch(url, { ...config, headers });

        if (!retryResponse.ok) {
          throw new ApiError(retryResponse.status, 'API Error after retry');
        }

        if (retryResponse.status === 204) return null;
        return await retryResponse.json();

      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        throw new ApiError(401, 'Session expired. Please log in again.');
      }
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText };
      }
      throw new ApiError(response.status, errorData.message || 'API Error', errorData);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error(error instanceof Error ? error.message : 'Network error');
  }
};
