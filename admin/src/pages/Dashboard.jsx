import React, { useState, useEffect } from "react";
import {
  Users,
  Gamepad2,
  TrendingUp,
  RefreshCw,
  UserCog,
  Wallet,
  Calendar,
  CalendarDays,
  CalendarRange,
  CreditCard,
  Percent,
  Edit2,
  Save,
  X,
  Loader2,
} from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";
import { useAuth } from "../context/AuthContext";

const StatCard = ({
  title,
  value,
  icon: IconComponent,
  color,
  loading,
  subtitle,
}) => (
  <div className="bg-white rounded-xl shadow-sm p-6 transition-transform hover:scale-[1.02]">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">
          {loading ? "..." : value}
        </p>
        {subtitle && !loading && (
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <IconComponent className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

// live

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [liveGames, setLiveGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Win cut state for cashiers
  const [winCut, setWinCut] = useState(10);
  const [editingWinCut, setEditingWinCut] = useState(false);
  const [winCutInput, setWinCutInput] = useState(10);
  const [savingWinCut, setSavingWinCut] = useState(false);
  const [winCutError, setWinCutError] = useState("");
  const [winCutSuccess, setWinCutSuccess] = useState("");

  const fetchDashboardData = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("bingo_admin_token");
      const response = await axios.get(`${API_URL}/api/games/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(response.data.stats || {});
      setRecentActivity(response.data.recentActivity || []);
      setLiveGames(response.data.liveGames || []);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(err.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch win cut for cashiers
  const fetchWinCut = async () => {
    if (user?.role !== "cashier") return;
    try {
      const token = localStorage.getItem("bingo_admin_token");
      const response = await axios.get(`${API_URL}/api/cashiers/my-wincut`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setWinCut(response.data.data.winCut ?? 10);
        setWinCutInput(response.data.data.winCut ?? 10);
      }
    } catch (err) {
      console.error("Error fetching win cut:", err);
    }
  };

  // Save win cut
  const handleSaveWinCut = async () => {
    const value = Number(winCutInput);
    if (isNaN(value) || value < 0 || value > 100) {
      setWinCutError("Win cut must be between 0 and 100");
      return;
    }

    setSavingWinCut(true);
    setWinCutError("");
    try {
      const token = localStorage.getItem("bingo_admin_token");
      const response = await axios.put(
        `${API_URL}/api/cashiers/my-wincut`,
        { winCut: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setWinCut(response.data.data.winCut);
        setWinCutInput(response.data.data.winCut);
        setEditingWinCut(false);
        setWinCutSuccess("Win cut updated!");
        setTimeout(() => setWinCutSuccess(""), 3000);
      }
    } catch (err) {
      setWinCutError(err.response?.data?.message || "Failed to update win cut");
    } finally {
      setSavingWinCut(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchWinCut();
  }, [user?.role]);

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "Br 0";
    return `Br ${amount.toLocaleString()}`;
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      playing: "bg-blue-100 text-blue-800",
      waiting: "bg-yellow-100 text-yellow-800",
      finished: "bg-green-100 text-green-800",
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          statusConfig[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status === "playing"
          ? "Playing"
          : status === "waiting"
          ? "Waiting"
          : "Live"}
      </span>
    );
  };

  const getRoleTitle = () => {
    switch (user?.role) {
      case "admin":
        return "Admin Dashboard";
      case "agent":
        return "Agent Dashboard";
      case "cashier":
        return "Cashier Dashboard";
      default:
        return "Dashboard";
    }
  };

  const getRoleSubtitle = () => {
    switch (user?.role) {
      case "admin":
        return "Overview of all agents, cashiers, and game statistics";
      case "agent":
        return "Overview of your cashiers and game statistics";
      case "cashier":
        return "Overview of your game statistics";
      default:
        return "Welcome to Bani Bingo";
    }
  };

  // Build stat cards based on role
  const getStatCards = () => {
    const cards = [];

    // Wallet balance for agents and cashiers (show first for prominence)
    if (
      (user?.role === "agent" || user?.role === "cashier") &&
      stats.walletBalance !== undefined
    ) {
      cards.push({
        title: "Wallet Balance",
        value: formatCurrency(stats.walletBalance?.value || 0),
        icon: CreditCard,
        color: "bg-emerald-500",
        subtitle: `Bonus: ${formatCurrency(stats.walletBonus?.value || 0)}`,
      });
    }

    // Role-specific counts
    if (user?.role === "admin") {
      cards.push({
        title: "Total Agents",
        value: stats.totalAgents?.value?.toString() || "0",
        icon: UserCog,
        color: "bg-indigo-500",
      });
      cards.push({
        title: "Total Cashiers",
        value: stats.totalCashiers?.value?.toString() || "0",
        icon: Wallet,
        color: "bg-pink-500",
      });
    }

    if (user?.role === "agent") {
      cards.push({
        title: "My Cashiers",
        value: stats.totalCashiers?.value?.toString() || "0",
        icon: Users,
        color: "bg-pink-500",
      });
    }

    // Game stats - titles differ based on role
    const getGameTitle = (period) => {
      if (user?.role === "cashier") {
        return `My ${period} Games`;
      } else if (user?.role === "agent") {
        return `Cashiers' ${period} Games`;
      }
      return `Total ${period} Games`;
    };

    cards.push({
      title: getGameTitle("Daily"),
      value: stats.dailyGames?.value?.toString() || "0",
      icon: Calendar,
      color: "bg-blue-500",
      subtitle: `Revenue: ${formatCurrency(stats.dailyRevenue?.value || 0)}`,
    });

    cards.push({
      title: getGameTitle("Weekly"),
      value: stats.weeklyGames?.value?.toString() || "0",
      icon: CalendarDays,
      color: "bg-purple-500",
      subtitle: `Revenue: ${formatCurrency(stats.weeklyRevenue?.value || 0)}`,
    });

    cards.push({
      title: getGameTitle("Monthly"),
      value: stats.monthlyGames?.value?.toString() || "0",
      icon: CalendarRange,
      color: "bg-green-500",
      subtitle: `Revenue: ${formatCurrency(stats.monthlyRevenue?.value || 0)}`,
    });

    cards.push({
      title:
        user?.role === "cashier"
          ? "My Total Games"
          : user?.role === "agent"
          ? "Cashiers' Total Games"
          : "All Games",
      value: stats.totalGames?.value?.toString() || "0",
      icon: Gamepad2,
      color: "bg-orange-500",
      subtitle: `Revenue: ${formatCurrency(stats.totalRevenue?.value || 0)}`,
    });

    cards.push({
      title: "Active Games",
      value: stats.activeGames?.value?.toString() || "0",
      icon: TrendingUp,
      color: "bg-cyan-500",
    });

    return cards;
  };

  const statCards = getStatCards();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{getRoleTitle()}</h2>
          <p className="text-gray-500">{getRoleSubtitle()}</p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <StatCard key={stat.title} {...stat} loading={loading} />
        ))}
      </div>

      {/* Win Cut Settings Card - Cashiers Only */}
      {user?.role === "cashier" && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              
              <div>
                <h3 className="text-lg font-bold text-gray-900">Win Cut Settings</h3>
               
              </div>
            </div>
            {!editingWinCut && (
              <button
                onClick={() => {
                  setEditingWinCut(true);
                  setWinCutInput(winCut);
                  setWinCutError("");
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>

          {winCutSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {winCutSuccess}
            </div>
          )}

          {winCutError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {winCutError}
            </div>
          )}

          {editingWinCut ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={winCutInput}
                  onChange={(e) => setWinCutInput(e.target.value)}
                  className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-lg font-bold"
                />
                <span className="text-gray-500 font-medium">%</span>
              </div>
              <button
                onClick={handleSaveWinCut}
                disabled={savingWinCut}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {savingWinCut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
              <button
                onClick={() => {
                  setEditingWinCut(false);
                  setWinCutInput(winCut);
                  setWinCutError("");
                }}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900">{winCut}</span>
              <span className="text-xl text-gray-500">%</span>
            </div>
          )}

         
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            {user?.role === "cashier"
              ? "My Recent Games"
              : user?.role === "agent"
              ? "My Cashiers' Recent Games"
              : "Recent Activity"}
          </h3>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {user?.role === "cashier"
                ? "You haven't hosted any games yet"
                : user?.role === "agent"
                ? "Your cashiers haven't hosted any games yet"
                : "No recent activity"}
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                      <Gamepad2 className="w-4 h-4" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        Winner: {activity.winner}
                        {(user?.role === "admin" || user?.role === "agent") &&
                          activity.cashier &&
                          activity.cashier !== "N/A" &&
                          ` • Host: ${activity.cashier}`}
                        {" • "}
                        {formatTimeAgo(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-blue-600">
                    {formatCurrency(activity.prize || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            {user?.role === "cashier"
              ? "My Live Games"
              : user?.role === "agent"
              ? "My Cashiers' Live Games"
              : "Live Games"}
          </h3>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : liveGames.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {user?.role === "cashier"
                ? "You have no live games"
                : user?.role === "agent"
                ? "Your cashiers have no live games"
                : "No live games"}
            </div>
          ) : (
            <div className="space-y-4">
              {liveGames.map((game) => {
                const fillPercentage =
                  game.maxPlayers > 0
                    ? (game.playerCount / game.maxPlayers) * 100
                    : 0;
                return (
                  <div key={game.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">
                        Room #{game.roomId}
                      </span>
                      {getStatusBadge(game.status)}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${fillPercentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>
                        Players: {game.playerCount}/{game.maxPlayers}
                      </span>
                      <span>Stake: {formatCurrency(game.stake)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div> */}
      </div>
    </div>
  );
};

export default Dashboard;