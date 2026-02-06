import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import { API_URL } from "../constant";

const AuthContext = createContext();

// Local storage keys for local players
const LOCAL_PLAYER_NAME_KEY = "localPlayerName";
const LOCAL_PLAYER_ID_KEY = "localPlayerId";
const LOCAL_PLAYER_DB_ID_KEY = "localPlayerDbId"; // MongoDB _id from backend

// Helper to get local player from storage
const getLocalPlayerFromStorage = () => {
  const name = localStorage.getItem(LOCAL_PLAYER_NAME_KEY);
  const localId = localStorage.getItem(LOCAL_PLAYER_ID_KEY);
  const dbId = localStorage.getItem(LOCAL_PLAYER_DB_ID_KEY);
  
  if (name && localId) {
    return {
      _id: dbId || localId, // Use DB id if available, otherwise local id
      id: dbId || localId,
      localPlayerId: localId,
      name,
      role: "user",
      isLocalPlayer: true,
    };
  }
  return null;
};

// Helper to save local player to storage
const saveLocalPlayerToStorage = (name, localId, dbId = null) => {
  localStorage.setItem(LOCAL_PLAYER_NAME_KEY, name);
  localStorage.setItem(LOCAL_PLAYER_ID_KEY, localId);
  if (dbId) {
    localStorage.setItem(LOCAL_PLAYER_DB_ID_KEY, dbId);
  }
  return {
    _id: dbId || localId,
    id: dbId || localId,
    localPlayerId: localId,
    name,
    role: "user",
    isLocalPlayer: true,
  };
};

// Helper to update the DB id in storage
const updateDbIdInStorage = (dbId) => {
  localStorage.setItem(LOCAL_PLAYER_DB_ID_KEY, dbId);
};

// Helper to clear local player from storage
const clearLocalPlayerStorage = () => {
  localStorage.removeItem(LOCAL_PLAYER_NAME_KEY);
  localStorage.removeItem(LOCAL_PLAYER_ID_KEY);
  localStorage.removeItem(LOCAL_PLAYER_DB_ID_KEY);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token"));

  // Define logout function first to avoid reference errors
  const logout = useCallback(() => {
    console.log(" Logging out user");
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    clearLocalPlayerStorage();
  }, []);

  // Sync local player with backend to get MongoDB _id
  const syncLocalPlayerWithBackend = async (localPlayer) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/local-player`, {
        localPlayerId: localPlayer.localPlayerId,
        name: localPlayer.name,
      });
      
      const dbUser = response.data.user;
      // Update storage with the MongoDB _id
      updateDbIdInStorage(dbUser._id);
      
      return {
        ...localPlayer,
        _id: dbUser._id,
        id: dbUser._id,
      };
    } catch (error) {
      console.error("Failed to sync local player with backend:", error);
      // Return original local player if sync fails
      return localPlayer;
    }
  };

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
      // First check for token-based auth (cashiers, agents, admins)
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
      } else {
        // No token - check for local player (regular players without auth)
        const localPlayer = getLocalPlayerFromStorage();
        if (localPlayer) {
          // Sync with backend to ensure we have the correct MongoDB _id
          const syncedPlayer = await syncLocalPlayerWithBackend(localPlayer);
          setUser(syncedPlayer);
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

      // Clear local player if logging in with token
      clearLocalPlayerStorage();

      setToken(newToken);
      setUser(userData);
      localStorage.setItem("token", newToken);

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Login failed",
      };
    }
  };

  const signup = async (phoneNumber, otp, pin, name) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/verify-otp`, {
        phoneNumber,
        otp,
        pin,
        name,
      });

      const { token: newToken, user: userData } = response.data;

      // Clear local player if signing up with token
      clearLocalPlayerStorage();

      setToken(newToken);
      setUser(userData);
      localStorage.setItem("token", newToken);

      return { success: true };
    } catch (error) {
      console.error("Signup error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Signup failed",
      };
    }
  };

  const sendOTP = async (phoneNumber) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/send-otp`, {
        phoneNumber,
      });

      return {
        success: true,
        otp: response.data.otp, // In development, this will contain the OTP
      };
    } catch (error) {
      console.error("Send OTP error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to send OTP",
      };
    }
  };

  const resendOTP = async (phoneNumber) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/resend-otp`, {
        phoneNumber,
      });

      return {
        success: true,
        otp: response.data.otp, // In development, this will contain the OTP
      };
    } catch (error) {
      console.error("Resend OTP error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to resend OTP",
      };
    }
  };

  // Set local player (for players without authentication)
  const setLocalPlayer = useCallback(async (name) => {
    const localId = `local-${Date.now()}`;
    
    // First save to localStorage with temporary ID
    let localPlayer = saveLocalPlayerToStorage(name, localId);
    setUser(localPlayer);
    
    // Then sync with backend to get MongoDB _id
    try {
      const response = await axios.post(`${API_URL}/api/auth/local-player`, {
        localPlayerId: localId,
        name,
      });
      
      const dbUser = response.data.user;
      // Update storage and state with the MongoDB _id
      updateDbIdInStorage(dbUser._id);
      
      const syncedPlayer = {
        ...localPlayer,
        _id: dbUser._id,
        id: dbUser._id,
      };
      setUser(syncedPlayer);
      return syncedPlayer;
    } catch (error) {
      console.error("Failed to sync local player with backend:", error);
      // Return local player even if sync fails (will retry on next load)
      return localPlayer;
    }
  }, []);

  // Check if there's a local player name in storage (used to show/hide name input)
  const hasLocalPlayerName = useCallback(() => {
    return !!localStorage.getItem(LOCAL_PLAYER_NAME_KEY);
  }, []);

  const value = {
    user,
    token,
    loading,
    login,
    signup,
    sendOTP,
    resendOTP,
    logout,
    isAuthenticated: !!user,
    // New methods for local players
    setLocalPlayer,
    hasLocalPlayerName,
    isLocalPlayer: user?.isLocalPlayer || false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
