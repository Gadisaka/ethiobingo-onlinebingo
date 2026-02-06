import { create } from "zustand";
import axios from "axios";
import { API_URL } from "../constant";

const useAgentStore = create((set, get) => ({
  // State
  agents: [],
  loading: false,
  saving: false,
  error: null,
  success: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  },
  filters: {
    search: "",
    isActive: "",
  },

  // Actions
  fetchAgents: async (page, limit, filters = {}) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("bingo_admin_token");
      const params = new URLSearchParams({
        page: (page || get().pagination.page).toString(),
        limit: (limit || get().pagination.limit).toString(),
      });

      const currentFilters =
        filters.search !== undefined ? filters : get().filters;
      if (currentFilters.search) params.append("search", currentFilters.search);
      if (
        currentFilters.isActive !== undefined &&
        currentFilters.isActive !== ""
      )
        params.append("isActive", currentFilters.isActive);

      const response = await axios.get(
        `${API_URL}/api/sub-admins?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        set({
          agents: response.data.subAdmins || [],
          pagination: response.data.pagination,
          loading: false,
        });
      }
    } catch (error) {
      console.error("Error fetching agents:", error);
      set({
        agents: [],
        error: error.response?.data?.message || "Failed to load agents",
        loading: false,
      });
    }
  },

  createAgent: async (agentData) => {
    set({ saving: true, error: null, success: null });
    try {
      const token = localStorage.getItem("bingo_admin_token");
      const response = await axios.post(
        `${API_URL}/api/sub-admins`,
        agentData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        set({
          saving: false,
          success: response.data.message || "Agent created successfully",
        });
        // Refresh the list
        await get().fetchAgents();
        // Clear success message after 3 seconds
        setTimeout(() => set({ success: null }), 3000);
        return { success: true, data: response.data.data };
      }
    } catch (error) {
      console.error("Error creating agent:", error);
      set({
        error: error.response?.data?.message || "Failed to create agent",
        saving: false,
      });
      return { success: false, error: error.response?.data?.message };
    }
  },

  updateAgent: async (id, agentData) => {
    set({ saving: true, error: null, success: null });
    try {
      const token = localStorage.getItem("bingo_admin_token");
      const response = await axios.put(
        `${API_URL}/api/sub-admins/${id}`,
        agentData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        set({
          saving: false,
          success: response.data.message || "Agent updated successfully",
        });
        // Refresh the list
        await get().fetchAgents();
        // Clear success message after 3 seconds
        setTimeout(() => set({ success: null }), 3000);
        return { success: true, data: response.data.data };
      }
    } catch (error) {
      console.error("Error updating agent:", error);
      set({
        error: error.response?.data?.message || "Failed to update agent",
        saving: false,
      });
      return { success: false, error: error.response?.data?.message };
    }
  },

  deleteAgent: async (id) => {
    set({ saving: true, error: null, success: null });
    try {
      const token = localStorage.getItem("bingo_admin_token");
      const response = await axios.delete(`${API_URL}/api/sub-admins/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        set({
          saving: false,
          success: response.data.message || "Agent deleted successfully",
        });
        // Refresh the list
        await get().fetchAgents();
        // Clear success message after 3 seconds
        setTimeout(() => set({ success: null }), 3000);
        return { success: true };
      }
    } catch (error) {
      console.error("Error deleting agent:", error);
      set({
        error: error.response?.data?.message || "Failed to delete agent",
        saving: false,
      });
      return { success: false, error: error.response?.data?.message };
    }
  },

  topUpWallet: async (id, amount) => {
    set({ saving: true, error: null, success: null });
    try {
      const token = localStorage.getItem("bingo_admin_token");
      const response = await axios.post(
        `${API_URL}/api/sub-admins/${id}/topup`,
        { amount },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        set({
          saving: false,
          success: response.data.message || "Wallet topped up successfully",
        });
        // Refresh the list
        await get().fetchAgents();
        // Clear success message after 3 seconds
        setTimeout(() => set({ success: null }), 3000);
        return { success: true, data: response.data.data };
      }
    } catch (error) {
      console.error("Error topping up wallet:", error);
      set({
        error: error.response?.data?.message || "Failed to top up wallet",
        saving: false,
      });
      return { success: false, error: error.response?.data?.message };
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 },
    }));
  },

  setPagination: (pagination) => {
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    }));
  },

  clearError: () => set({ error: null }),
  clearSuccess: () => set({ success: null }),
}));

export default useAgentStore;
