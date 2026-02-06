import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API_URL } from "../constant";

const BannerContext = createContext();

export function BannerProvider({ children }) {
  const [bannerData, setBannerData] = useState({
    enabled: false,
    images: [],
    displayOn: { friends: true, waitingRoom: true, playingRoom: true },
    autoPlay: true,
    interval: 5000,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBanner = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/settings/banner`);
      const data = await res.json();
      
      if (data.success && data.data) {
        setBannerData(data.data);
      }
    } catch (err) {
      console.error("Error fetching banner:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanner();
  }, [fetchBanner]);

  // Check if banner should display on a specific page
  const shouldDisplayOn = useCallback(
    (page) => {
      if (!bannerData.enabled) return false;
      if (!bannerData.images || bannerData.images.length === 0) return false;
      return bannerData.displayOn?.[page] ?? true;
    },
    [bannerData]
  );

  return (
    <BannerContext.Provider
      value={{
        bannerData,
        loading,
        error,
        refetch: fetchBanner,
        shouldDisplayOn,
      }}
    >
      {children}
    </BannerContext.Provider>
  );
}

export function useBanner() {
  const context = useContext(BannerContext);
  if (!context) {
    throw new Error("useBanner must be used within a BannerProvider");
  }
  return context;
}
