import { createContext, useContext, useEffect, useRef, useState } from "react";
import api, { setUnauthorizedHandler } from "../api/axios";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    localStorage.getItem("token")
  );

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(token);
  const mountedRef = useRef(true);

  const clearSession = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    mountedRef.current = true;
    const unregisterUnauthorizedHandler = setUnauthorizedHandler((error) => {
      const authorization = error.config?.headers?.Authorization ||
        error.config?.headers?.authorization;
      const requestToken = authorization?.replace(
        /^Bearer\s+/i,
        ""
      );

      if (!mountedRef.current || (requestToken && requestToken !== tokenRef.current)) {
        return;
      }

      clearSession();
    });

    return () => {
      mountedRef.current = false;
      unregisterUnauthorizedHandler();
    };
  }, []);
  const hasRole = (role) => {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return roles.includes(role);
  };
  const hasAnyRole = (allowedRoles) =>
    allowedRoles.some((role) => hasRole(role));

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      if (!token) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const response = await api.get("/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (mounted) {
          setUser(response.data.data);
        }
      } catch (error) {
        console.warn("User request failed", error.response?.status || "network");

        if (mounted && [401, 403].includes(error.response?.status)) {
          if (localStorage.getItem("token") === token) {
            clearSession();
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [token]);

  // Re-fetch the current user after a profile or role change.
  const refreshUser = async () => {
    if (!tokenRef.current) {
      return null;
    }

    try {
      const response = await api.get("/users/me", {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      setUser(response.data.data);
      return response.data.data;
    } catch (error) {
      console.warn("User refresh failed", error.response?.status || "network");
      return null;
    }
  };

  // Login
  const login = async (email, password) => {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    const newToken = response.data.token;

    if (response.data.data) {
      setUser(response.data.data);
    }

    localStorage.setItem("token", newToken);
    setToken(newToken);

    return response.data;
  };

  // Register
  const register = async (userData) => {
    const response = await api.post("/auth/register", userData);

    return response.data;
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        hasRole,
        hasAnyRole,
        isPassenger: hasRole("passenger"),
        isDriver: hasRole("driver"),
        isAdmin: hasRole("admin"),
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}