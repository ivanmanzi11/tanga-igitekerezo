import { createContext, useContext, useEffect, useState } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("tgk_access");
    if (!token) {
      setLoading(false);
      return;
    }
    client
      .get("/auth/me/")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("tgk_access");
        localStorage.removeItem("tgk_refresh");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password, portal) {
    const { data } = await client.post("/auth/login/", { username, password, portal });
    localStorage.setItem("tgk_access", data.access);
    localStorage.setItem("tgk_refresh", data.refresh);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem("tgk_access");
    localStorage.removeItem("tgk_refresh");
    setUser(null);
  }

  // Admin2 ADM_01: admins always have full access; everyone else only has
  // whatever permissions their current group(s) grant.
  function hasPermission(codename) {
    if (!user) return false;
    if (user.role === "admin") return true;
    return (user.permissions || []).includes(codename);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
