import axios from "axios";

let unauthorizedHandler = null;
const apiBaseUrl = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : undefined);

if (!apiBaseUrl) {
  throw new Error("VITE_API_URL must be configured for production builds.");
}

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData && config.headers) {
    delete config.headers["Content-Type"];
    delete config.headers["content-type"];
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || "";
    const isAuthRequest = requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register");
    const authorization = error.config?.headers?.Authorization ||
      error.config?.headers?.authorization;

    if (error.response?.status === 401 && !isAuthRequest && authorization) {
      unauthorizedHandler?.(error);
    }

    return Promise.reject(error);
  }
);

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;

  return () => {
    if (unauthorizedHandler === handler) {
      unauthorizedHandler = null;
    }
  };
};

export default api;