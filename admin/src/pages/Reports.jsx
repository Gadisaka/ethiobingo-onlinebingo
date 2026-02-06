import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  RefreshCw,
  Filter,
  Calendar,
  DollarSign,
  Gamepad2,
  TrendingUp,
} from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";
import { useAuth } from "../context/AuthContext";

const Reports = () => {
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    agentId: "",
    cashierId: "",
  });
  const [agents, setAgents] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(false);

  // Fetch agents for admin
  const fetchAgents = useCallback(async () => {
    if (user?.role !== "admin") return;
    setLoadingAgents(true);
    try {
      const token = localStorage.getItem("bingo_admin_token");
      const response = await axios.get(`${API_URL}/api/sub-admins`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 1000 }, // Get all agents
      });
      setAgents(response.data.subAdmins || []);
    } catch (err) {
      console.error("Error fetching agents:", err);
    } finally {
      setLoadingAgents(false);
    }
  }, [user?.role]);

  // Fetch cashiers for admin (filtered by agent if selected)
  const fetchCashiers = useCallback(async () => {
    if (user?.role !== "admin") return;
    setLoadingCashiers(true);
    try {
      const token = localStorage.getItem("bingo_admin_token");
      const params = { limit: 1000 }; // Get all cashiers
      if (filters.agentId) {
        params.agentId = filters.agentId;
      }
      const response = await axios.get(
        `${API_URL}/api/sub-admins/all-cashiers`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }
      );
      setCashiers(response.data.cashiers || []);
    } catch (err) {
      console.error("Error fetching cashiers:", err);
    } finally {
      setLoadingCashiers(false);
    }
  }, [user?.role, filters.agentId]);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("bingo_admin_token");
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.agentId) params.append("agentId", filters.agentId);
      if (filters.cashierId) params.append("cashierId", filters.cashierId);

      const response = await axios.get(
        `${API_URL}/api/games/history?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setGames(response.data.games || []);
      setPagination((prev) => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        totalPages: response.data.pagination?.totalPages || 0,
      }));
    } catch (err) {
      console.error("Error fetching games:", err);
      setError(err.response?.data?.message || "Failed to load games");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    fetchCashiers();
  }, [fetchCashiers]);

  // Reset cashier filter when agent changes
  useEffect(() => {
    if (filters.agentId) {
      setFilters((prev) => ({ ...prev, cashierId: "" }));
    }
  }, [filters.agentId]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "Br 0";
    return `Br ${amount.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      playing: "bg-blue-100 text-blue-800",
      waiting: "bg-yellow-100 text-yellow-800",
      finished: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          statusConfig[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status}
      </span>
    );
  };

  const getGameTypeBadge = (type) => {
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          type === "system"
            ? "bg-purple-100 text-purple-800"
            : "bg-indigo-100 text-indigo-800"
        }`}
      >
        {type === "system" ? "System" : "User"}
      </span>
    );
  };

  // Calculate summary stats from current page
  const totalRevenue = games.reduce(
    (sum, game) => sum + (game.stake || 0) * (game.playerCount || 0),
    0
  );
  const totalGames = pagination.total;
  const finishedGames = games.filter((g) => g.gameStatus === "finished").length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {user?.role === "cashier"
              ? "My Game Reports"
              : user?.role === "agent"
              ? "My Cashiers' Game Reports"
              : "Game Reports"}
          </h2>
          <p className="text-gray-500">
            {user?.role === "cashier"
              ? "View your game history and revenue reports"
              : user?.role === "agent"
              ? "View game history and revenue reports from your cashiers"
              : "View game history and revenue reports"}
          </p>
        </div>
        <button
          onClick={fetchGames}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                {user?.role === "cashier"
                  ? "My Total Games"
                  : user?.role === "agent"
                  ? "Cashiers' Total Games"
                  : "Total Games"}
              </p>
              <p className="text-2xl font-bold text-gray-900">{totalGames}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500">
              <Gamepad2 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                {user?.role === "cashier"
                  ? "My Finished Games"
                  : user?.role === "agent"
                  ? "Cashiers' Finished Games"
                  : "Finished Games"}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {finishedGames}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-500">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                {user?.role === "cashier"
                  ? "My Revenue"
                  : user?.role === "agent"
                  ? "Cashiers' Revenue"
                  : "Total Revenue"}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <div className="flex gap-4 flex-1 flex-wrap">
            {/* Agent filter - Admin only */}
            {user?.role === "admin" && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agent
                </label>
                <select
                  value={filters.agentId}
                  onChange={(e) =>
                    handleFilterChange("agentId", e.target.value)
                  }
                  disabled={loadingAgents}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">All Agents</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cashier filter - Admin only */}
            {user?.role === "admin" && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cashier
                </label>
                <select
                  value={filters.cashierId}
                  onChange={(e) =>
                    handleFilterChange("cashierId", e.target.value)
                  }
                  disabled={loadingCashiers}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">All Cashiers</option>
                  {cashiers.map((cashier) => (
                    <option key={cashier.id} value={cashier.id}>
                      {cashier.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date filters - All roles */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                min={filters.startDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Games Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading && games.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <p className="text-gray-500">Loading games...</p>
          </div>
        ) : games.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              No Games Found
            </h3>
            <p className="text-gray-500 mt-2">
              {user?.role === "cashier"
                ? "You haven't hosted any games yet that match your filter criteria."
                : user?.role === "agent"
                ? "Your cashiers haven't hosted any games yet that match your filter criteria."
                : "No games match your filter criteria."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Room ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Players
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stake
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prize
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Winner
                    </th>
                    {(user?.role === "admin" || user?.role === "agent") && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cashier
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {games.map((game) => (
                    <tr
                      key={game.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{String(game.roomId).slice(-8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getGameTypeBadge(game.gameType)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(game.gameStatus)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {game.playerCount}/{game.maxPlayers}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(game.stake)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(game.prize)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {game.winner?.userName || game.winner?.name || "-"}
                      </td>
                      {(user?.role === "admin" || user?.role === "agent") && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {game.cashierName || "-"}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(game.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing{" "}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total
                    )}
                  </span>{" "}
                  of <span className="font-medium">{pagination.total}</span>{" "}
                  results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
