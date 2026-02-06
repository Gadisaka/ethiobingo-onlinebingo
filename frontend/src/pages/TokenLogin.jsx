import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "../constant";
import { Loader2 } from "lucide-react";

export default function TokenLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const redirect = searchParams.get("redirect") || "/";

    if (!token) {
      setError("No token provided");
      setTimeout(() => navigate("/auth"), 2000);
      return;
    }

    const loginWithToken = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/token-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Token login failed");
        }

        // Store token and user data
        localStorage.setItem("token", data.token);
        
        // Reload the page to reinitialize auth context with the new token
        window.location.href = redirect;
      } catch (err) {
        console.error("Token login error:", err);
        setError(err.message);
        setTimeout(() => navigate("/auth"), 2000);
      }
    };

    loginWithToken();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <div className="text-red-400">
            <p className="text-lg font-medium">{error}</p>
            <p className="text-sm text-red-300/70 mt-2">Redirecting to login...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-sky-200">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-lg font-medium">Logging you in...</p>
          </div>
        )}
      </div>
    </div>
  );
}

