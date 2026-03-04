import { createContext, useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { getMe } from "./api";

const AuthContext = createContext(null);

const STORAGE_KEY = "ai-interview-auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    const init = async () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        if (!canceled) setLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(stored);
        if (!canceled) {
          setUser(parsed.user || null);
          setToken(parsed.token || null);
        }

        if (parsed?.token) {
          try {
            const data = await getMe(parsed.token);
            if (!canceled && data?.user) {
              setUser(data.user);
              window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ user: data.user, token: parsed.token })
              );
            }
          } catch {
            // Token might be expired or invalid; clear stored auth.
            if (!canceled) {
              setUser(null);
              setToken(null);
            }
            window.localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    init();
    return () => {
      canceled = true;
    };
  }, []);

  const saveAuth = (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: nextUser, token: nextToken })
    );
  };

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    saveAuth,
    clearAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node,
};

export function useAuth() {
  return useContext(AuthContext);
}
