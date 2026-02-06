import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  RefreshCw,
  Filter,
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  DollarSign,
} from "lucide-react";
import useCashierStore from "../store/cashierStore";

const Cashier = () => {
  const [showModal, setShowModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [editingCashier, setEditingCashier] = useState(null);
  const [topUpCashier, setTopUpCashier] = useState(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    pin: "",
    sharePercent: 10,
    isActive: true,
  });

  const {
    cashiers,
    loading,
    saving,
    error,
    success,
    pagination,
    filters,
    fetchCashiers,
    createCashier,
    updateCashier,
    deleteCashier,
    topUpWallet,
    setFilters,
    setPagination,
    clearError,
    clearSuccess,
  } = useCashierStore();

  // Local state for form validation errors
  const [formError, setFormError] = useState(null);

  // Fetch cashiers on component mount and when filters/pagination change
  const loadCashiers = useCallback(() => {
    fetchCashiers(pagination.page, pagination.limit, filters);
  }, [fetchCashiers, pagination.page, pagination.limit, filters]);

  useEffect(() => {
    loadCashiers();
  }, [loadCashiers]);

  // Clear messages when component unmounts
  useEffect(() => {
    return () => {
      clearError();
      clearSuccess();
    };
  }, [clearError, clearSuccess]);

  const handleFilterChange = (key, value) => {
    setFilters({ [key]: value });
  };

  const handlePageChange = (newPage) => {
    setPagination({ page: newPage });
  };

  const openAddModal = () => {
    setEditingCashier(null);
    setFormData({
      name: "",
      phoneNumber: "",
      pin: "",
      sharePercent: 10,
      isActive: true,
    });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (cashier) => {
    setEditingCashier(cashier);
    setFormData({
      name: cashier.name,
      phoneNumber: cashier.phoneNumber,
      pin: "",
      sharePercent: cashier.sharePercent || 10,
      isActive: cashier.isActive,
    });
    setFormError(null);
    setShowModal(true);
  };

  const openTopUpModal = (cashier) => {
    setTopUpCashier(cashier);
    setTopUpAmount("");
    setFormError(null);
    setShowTopUpModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCashier(null);
    setFormData({
      name: "",
      phoneNumber: "",
      pin: "",
      sharePercent: 10,
      isActive: true,
    });
    setFormError(null);
  };

  const closeTopUpModal = () => {
    setShowTopUpModal(false);
    setTopUpCashier(null);
    setTopUpAmount("");
    setFormError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!formData.name || !formData.phoneNumber) {
      setFormError("Name and phone number are required");
      return;
    }

    if (!editingCashier && !formData.pin) {
      setFormError("PIN is required for new cashiers");
      return;
    }

    if (formData.sharePercent < 1 || formData.sharePercent > 100) {
      setFormError("Share percent must be between 1 and 100");
      return;
    }

    const submitData = { ...formData };
    if (!submitData.pin) {
      delete submitData.pin;
    }

    const result = editingCashier
      ? await updateCashier(editingCashier.id, submitData)
      : await createCashier(submitData);

    if (result.success) {
      closeModal();
    } else if (result.error) {
      setFormError(result.error);
    }
  };

  const handleTopUp = async (e) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) {
      setFormError("Please enter a valid amount");
      return;
    }

    const result = await topUpWallet(topUpCashier.id, amount);

    if (result.success) {
      closeTopUpModal();
    } else if (result.error) {
      setFormError(result.error);
    }
  };

  const handleDelete = async (id) => {
    if (
      window.confirm(
        "Are you sure you want to permanently delete this cashier? This action cannot be undone."
      )
    ) {
      await deleteCashier(id);
    }
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

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "Br 0";
    return `Br ${amount.toLocaleString()}`;
  };

  const getStatusBadge = (isActive) => {
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}
      >
        {isActive ? "Active" : "Inactive"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Cashier Management
          </h2>
          <p className="text-gray-500">
            Manage cashier accounts, wallets, and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadCashiers}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Cashier
          </button>
        </div>
      </div>

      {(error || formError) && !showModal && !showTopUpModal && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded flex justify-between items-center">
          <span>{error || formError}</span>
          <button
            onClick={() => {
              clearError();
              setFormError(null);
            }}
            className="text-red-700 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 text-green-700 rounded flex justify-between items-center">
          <span>{success}</span>
          <button
            onClick={clearSuccess}
            className="text-green-700 hover:text-green-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <div className="flex gap-4 flex-1 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.isActive}
                onChange={(e) => handleFilterChange("isActive", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Cashiers Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading && cashiers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <p className="text-gray-500">Loading cashiers...</p>
          </div>
        ) : cashiers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              No Cashiers Found
            </h3>
            <p className="text-gray-500 mt-2">
              No cashiers match your search criteria. Click "Add Cashier" to
              create one.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wallet
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Share %
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cashiers.map((cashier) => (
                    <tr
                      key={cashier.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {cashier.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cashier.phoneNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                          <Wallet className="w-4 h-4" />
                          {formatCurrency(cashier.walletBalance)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cashier.sharePercent || 10}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(cashier.isActive)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cashier.lastLogin
                          ? formatDate(cashier.lastLogin)
                          : "Never"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openTopUpModal(cashier)}
                            className="text-green-600 hover:text-green-900 p-1"
                            title="Top Up Wallet"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(cashier)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(cashier.id)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingCashier ? "Edit Cashier" : "Add Cashier"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 text-red-700 rounded text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PIN{" "}
                  {!editingCashier && <span className="text-red-500">*</span>}
                  {editingCashier && (
                    <span className="text-gray-500 text-xs ml-1">
                      (Leave empty to keep current)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={formData.pin}
                  onChange={(e) =>
                    setFormData({ ...formData, pin: e.target.value })
                  }
                  required={!editingCashier}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Share Percentage <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.sharePercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sharePercent: parseInt(e.target.value) || 10,
                    })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-gray-500 mt-1">
                  e.g., 10% means adding 10 birr = cashier gets 100 birr
                </p>
              </div>

              {editingCashier && (
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Active
                    </span>
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingCashier ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Up Modal */}
      {showTopUpModal && topUpCashier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Top Up Wallet</h3>
              <button
                onClick={closeTopUpModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Cashier:{" "}
                <span className="font-medium">{topUpCashier.name}</span>
              </p>
              <p className="text-sm text-gray-600">
                Current Balance:{" "}
                <span className="font-medium text-green-600">
                  {formatCurrency(topUpCashier.walletBalance)}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                Share:{" "}
                <span className="font-medium">
                  {topUpCashier.sharePercent || 10}%
                </span>
              </p>
            </div>

            {formError && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 text-red-700 rounded text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleTopUp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (Birr) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  required
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {topUpAmount && parseFloat(topUpAmount) > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                    <p className="text-blue-700">
                      Cashier will receive:{" "}
                      <span className="font-bold">
                        {formatCurrency(
                          (parseFloat(topUpAmount) /
                            (topUpCashier.sharePercent || 10)) *
                            100
                        )}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeTopUpModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Top Up"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cashier;
