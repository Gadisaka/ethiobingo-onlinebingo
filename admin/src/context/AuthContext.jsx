import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import { API_URL } from "../constant";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("bingo_admin_token"));

  // Define logout function first to avoid reference errors
  const logout = useCallback(() => {
    console.log("Logging out admin user");
    setToken(null);
    setUser(null);
    localStorage.removeItem("bingo_admin_token");
  }, []);

  // Set up axios interceptor for authentication
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => axios.interceptors.request.eject(interceptor);
  }, [token]);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_URL}/api/auth/profile`);
          setUser(response.data.user);
        } catch (error) {
          console.error(
            "Auth check failed:",
            error.response?.data || error.message
          );
          // Only logout if it's a real authentication error, not a network error
          if (error.response?.status === 401) {
            logout();
          } else {
            // For network errors, keep the user logged in but set loading to false
            console.log(
              "Network error during auth check, keeping user logged in"
            );
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token, logout]);

  const login = async (phoneNumber, pin) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        phoneNumber,
        pin,
      });

      const { token: newToken, user: userData } = response.data;

      // Check if user has admin, agent, or cashier role
      if (userData.role !== "admin" && userData.role !== "agent" && userData.role !== "cashier") {
        throw new Error("Access denied. Admin/Agent/Cashier privileges required.");
      }

      setToken(newToken);
      setUser(userData);
      localStorage.setItem("bingo_admin_token", newToken);

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Login failed";
      throw new Error(errorMessage);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
