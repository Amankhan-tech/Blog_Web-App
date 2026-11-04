import { createContext, useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";

export const UserContext = createContext({});

export function UserContextProvider({ children }) {
  const [userInfo, setUserInfo] = useState(null);
  // false until we've asked the server whether the visitor is logged in, so
  // pages can wait instead of wrongly treating everyone as logged out.
  const [userReady, setUserReady] = useState(false);

  useEffect(() => {
    apiFetch("/profile").then(({ ok, data }) => {
      // 401 just means "not logged in"; not an error worth logging.
      setUserInfo(ok ? data : null);
      setUserReady(true);
    });
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/logout", { method: "POST" });
    setUserInfo(null);
  }, []);

  return (
    <UserContext.Provider value={{ userInfo, setUserInfo, userReady, logout }}>
      {children}
    </UserContext.Provider>
  );
}
