import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { API_URL } from "../constant";
import {
  Settings,
  Gift,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Gamepad2,
  Image,
  Users,
  Coins,
  Bell,
  Upload,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
} from "lucide-react";


export default function AdminSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("bonus");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Bonus state
  const [bonuses, setBonuses] = useState([]);
  const [isBonusActive, setIsBonusActive] = useState(true);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({ maxCalls: "", amount: "" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBonus, setNewBonus] = useState({ maxCalls: "", amount: "" });

  // Game settings state
  const [gameSettings, setGameSettings] = useState({
    minPlayers: 2,
    maxPlayers: 50,
    minStake: 5,
    maxStake: 500,
  });

  // Banner state - now with image slideshow
  const [bannerSettings, setBannerSettings] = useState({
    enabled: false,
    images: [], // Array of { url, publicId, link, alt }
    displayOn: {
      friends: true,
      waitingRoom: true,
      playingRoom: true,
    },
    autoPlay: true,
    interval: 5000,
    expiresAt: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInputRef = useRef(null);

  const tabs = [
    { id: "bonus", name: "Bonus Rewards", icon: Gift },
    { id: "game", name: "Game Settings", icon: Gamepad2 },
    { id: "banner", name: "Banner", icon: Image },
  ];

  // Fetch all settings
  const fetchSettings = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch bonus config
      const bonusRes = await axios.get(`${API_URL}/api/bonus/${user.id}`);
      setBonuses(bonusRes.data.bonuses || []);
      setIsBonusActive(bonusRes.data.isActive !== false);

      // Fetch global settings
      const settingsRes = await axios.get(`${API_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      
      if (settingsRes.data.success && settingsRes.data.data) {
        const data = settingsRes.data.data;
        
        // Game settings
        if (data.userGames) {
          setGameSettings({
            minPlayers: data.userGames.minPlayers || 2,
            maxPlayers: data.userGames.maxPlayers || 50,
            minStake: data.userGames.minStake || 5,
            maxStake: data.userGames.maxStake || 500,
          });
        }
        
        // Banner settings
        if (data.banner) {
          setBannerSettings({
            enabled: data.banner.enabled || false,
            images: data.banner.images || [],
            displayOn: data.banner.displayOn || { friends: true, waitingRoom: true, playingRoom: true },
            autoPlay: data.banner.autoPlay !== false,
            interval: data.banner.interval || 5000,
            expiresAt: data.banner.expiresAt 
              ? new Date(data.banner.expiresAt).toISOString().slice(0, 16) 
              : "",
          });
        }
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Save bonus config
  const saveBonusConfig = async (newBonuses, newIsActive = isBonusActive) => {
    if (!user?.id) return;

    try {
      setSaving(true);
      setError(null);

      const sortedBonuses = [...newBonuses].sort((a, b) => a.maxCalls - b.maxCalls);

      await axios.put(`${API_URL}/api/bonus/${user.id}`, {
        bonuses: sortedBonuses,
        isActive: newIsActive,
      });

      setBonuses(sortedBonuses);
      setIsBonusActive(newIsActive);
      setSuccess("Bonus settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error saving bonus config:", err);
      setError(err.response?.data?.message || "Failed to save bonus settings");
    } finally {
      setSaving(false);
    }
  };

  // Save game settings
  const saveGameSettings = async () => {
    try {
      setSaving(true);
      setError(null);

      await axios.put(
        `${API_URL}/api/settings`,
        { userGames: gameSettings },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      setSuccess("Game settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error saving game settings:", err);
      setError(err.response?.data?.message || "Failed to save game settings");
    } finally {
      setSaving(false);
    }
  };

  // Upload banner image
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB");
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await axios.post(`${API_URL}/api/upload/image`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.data.success) {
        const newImage = {
          url: response.data.imageUrl,
          publicId: response.data.publicId,
          link: "",
          alt: "",
        };

        setBannerSettings((prev) => ({
          ...prev,
          images: [...prev.images, newImage],
        }));
        setSuccess("Image uploaded successfully!");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Error uploading image:", err);
      setError(err.response?.data?.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Remove banner image
  const handleRemoveImage = (index) => {
    setBannerSettings((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    if (previewIndex >= bannerSettings.images.length - 1 && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  };

  // Update image link
  const handleUpdateImageLink = (index, link) => {
    setBannerSettings((prev) => ({
      ...prev,
      images: prev.images.map((img, i) =>
        i === index ? { ...img, link } : img
      ),
    }));
  };

  // Save banner settings
  const saveBannerSettings = async () => {
    try {
      setSaving(true);
      setError(null);

      const bannerData = {
        ...bannerSettings,
        expiresAt: bannerSettings.expiresAt ? new Date(bannerSettings.expiresAt).toISOString() : null,
      };

      await axios.put(
        `${API_URL}/api/settings`,
        { banner: bannerData },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      setSuccess("Banner settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error saving banner settings:", err);
      setError(err.response?.data?.message || "Failed to save banner settings");
    } finally {
      setSaving(false);
    }
  };

  // Bonus handlers
  const handleAddBonus = () => {
    const maxCalls = parseInt(newBonus.maxCalls);
    const amount = parseFloat(newBonus.amount);

    if (isNaN(maxCalls) || maxCalls < 1) {
      setError("Max calls must be a positive number");
      return;
    }
    if (isNaN(amount) || amount < 0) {
      setError("Amount must be a non-negative number");
      return;
    }

    if (bonuses.some((b) => b.maxCalls === maxCalls)) {
      setError("A bonus tier with this number of calls already exists");
      return;
    }

    const updatedBonuses = [...bonuses, { maxCalls, amount }];
    saveBonusConfig(updatedBonuses);
    setNewBonus({ maxCalls: "", amount: "" });
    setShowAddForm(false);
  };

  const handleEditBonus = (index) => {
    setEditingIndex(index);
    setEditForm({
      maxCalls: bonuses[index].maxCalls.toString(),
      amount: bonuses[index].amount.toString(),
    });
  };

  const handleSaveEdit = () => {
    const maxCalls = parseInt(editForm.maxCalls);
    const amount = parseFloat(editForm.amount);

    if (isNaN(maxCalls) || maxCalls < 1) {
      setError("Max calls must be a positive number");
      return;
    }
    if (isNaN(amount) || amount < 0) {
      setError("Amount must be a non-negative number");
      return;
    }

    if (bonuses.some((b, i) => i !== editingIndex && b.maxCalls === maxCalls)) {
      setError("A bonus tier with this number of calls already exists");
      return;
    }

    const updatedBonuses = bonuses.map((b, i) =>
      i === editingIndex ? { maxCalls, amount } : b
    );
    saveBonusConfig(updatedBonuses);
    setEditingIndex(null);
  };

  const handleDeleteBonus = (index) => {
    if (!confirm("Are you sure you want to delete this bonus tier?")) return;
    const updatedBonuses = bonuses.filter((_, i) => i !== index);
    saveBonusConfig(updatedBonuses);
  };

  const handleToggleBonusActive = () => {
    saveBonusConfig(bonuses, !isBonusActive);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-7 h-7 text-primary" />
            Admin Settings
          </h1>
          <p className="text-gray-500 mt-1">
            Configure game settings, bonuses, and announcements
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "bonus" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Gift className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Bonus Rewards
                  </h2>
                  <p className="text-sm text-gray-500">
                    Award bonus Birr to winners based on number of calls
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-gray-600">
                    {isBonusActive ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={handleToggleBonusActive}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isBonusActive ? "bg-primary" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isBonusActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>
          </div>

          <div className="p-6">
            {bonuses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b">
                      <th className="pb-3 font-medium">Max Calls</th>
                      <th className="pb-3 font-medium">Bonus Amount</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bonuses.map((bonus, index) => (
                      <tr key={index} className="group">
                        {editingIndex === index ? (
                          <>
                            <td className="py-3">
                              <input
                                type="number"
                                min="1"
                                value={editForm.maxCalls}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, maxCalls: e.target.value })
                                }
                                className="w-24 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              />
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editForm.amount}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, amount: e.target.value })
                                  }
                                  className="w-28 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                                <span className="text-gray-500">Birr</span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={handleSaveEdit}
                                  disabled={saving}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingIndex(null)}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3">
                              <span className="font-medium text-gray-900">
                                {bonus.maxCalls} calls
                              </span>
                            </td>
                            <td className="py-3">
                              <span className="text-amber-600 font-semibold">
                                {bonus.amount.toFixed(2)} Birr
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEditBonus(index)}
                                  className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteBonus(index)}
                                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Gift className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No bonus tiers configured yet</p>
                <p className="text-sm">Add bonus tiers to reward fast winners</p>
              </div>
            )}

            {showAddForm ? (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-end gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Calls
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g., 6"
                      value={newBonus.maxCalls}
                      onChange={(e) =>
                        setNewBonus({ ...newBonus, maxCalls: e.target.value })
                      }
                      className="w-28 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bonus Amount (Birr)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g., 1000"
                      value={newBonus.amount}
                      onChange={(e) =>
                        setNewBonus({ ...newBonus, amount: e.target.value })
                      }
                      className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <button
                    onClick={handleAddBonus}
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewBonus({ maxCalls: "", amount: "" });
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Bonus Tier
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === "game" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Gamepad2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Cashier Game Settings
                </h2>
                <p className="text-sm text-gray-500">
                  Set limits for games created by cashiers
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Player Limits */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                Player Limits
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Min Players
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={gameSettings.minPlayers}
                    onChange={(e) =>
                      setGameSettings({ ...gameSettings, minPlayers: parseInt(e.target.value) || 2 })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Max Players
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={gameSettings.maxPlayers}
                    onChange={(e) =>
                      setGameSettings({ ...gameSettings, maxPlayers: parseInt(e.target.value) || 50 })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Stake Limits */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Coins className="w-4 h-4 text-gray-500" />
                Stake Limits (Birr)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Min Stake
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={gameSettings.minStake}
                    onChange={(e) =>
                      setGameSettings({ ...gameSettings, minStake: parseInt(e.target.value) || 5 })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Max Stake
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={gameSettings.maxStake}
                    onChange={(e) =>
                      setGameSettings({ ...gameSettings, maxStake: parseInt(e.target.value) || 500 })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Note about Win Cut */}
            

            <div className="pt-4 border-t">
              <button
                onClick={saveGameSettings}
                disabled={saving}
                className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Game Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "banner" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Image className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Image Banner Slideshow
                  </h2>
                  <p className="text-sm text-gray-500">
                    Upload banner images with mobile-first design
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-gray-600">
                    {bannerSettings.enabled ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={() =>
                      setBannerSettings({ ...bannerSettings, enabled: !bannerSettings.enabled })
                    }
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      bannerSettings.enabled ? "bg-primary" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        bannerSettings.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Image Upload Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Banner Images
              </label>
              
              {/* Upload Button */}
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="banner-image-upload"
                />
                <label
                  htmlFor="banner-image-upload"
                  className={`inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors ${
                    uploadingImage ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {uploadingImage ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : (
                    <Upload className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-sm text-gray-600">
                    {uploadingImage ? "Uploading..." : "Upload Banner Image"}
                  </span>
                </label>
                <p className="mt-2 text-xs text-gray-400">
                  Recommended: Wide images (16:9 or 3:1 ratio). Max 5MB.
                </p>
              </div>

              {/* Uploaded Images Grid */}
              {bannerSettings.images.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {bannerSettings.images.map((image, index) => (
                    <div
                      key={index}
                      className="relative rounded-lg border border-gray-200 overflow-hidden"
                    >
                      <img
                        src={image.url}
                        alt={image.alt || `Banner ${index + 1}`}
                        className="w-full h-24 sm:h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleRemoveImage(index)}
                          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Image Link Input */}
                      <div className="p-2 bg-gray-50">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <input
                            type="text"
                            value={image.link || ""}
                            onChange={(e) => handleUpdateImageLink(index, e.target.value)}
                            placeholder="Optional link URL"
                            className="w-full text-xs px-2 py-1 border rounded focus:ring-1 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {bannerSettings.images.length === 0 && (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <Image className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No banner images uploaded</p>
                  <p className="text-xs text-gray-400">Upload images to create a slideshow</p>
                </div>
              )}
            </div>

            {/* Display Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Display On Pages
              </label>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: "friends", label: "Home Page" },
                  { key: "waitingRoom", label: "Waiting Page" },
                  { key: "playingRoom", label: "Playing Page" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bannerSettings.displayOn[key]}
                      onChange={(e) =>
                        setBannerSettings({
                          ...bannerSettings,
                          displayOn: { ...bannerSettings.displayOn, [key]: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-gray-600">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Slideshow Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bannerSettings.autoPlay}
                  onChange={(e) =>
                    setBannerSettings({ ...bannerSettings, autoPlay: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-600">Auto-play slideshow</span>
              </label>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Slide Interval (ms)</label>
                <input
                  type="number"
                  min="1000"
                  max="15000"
                  step="500"
                  value={bannerSettings.interval}
                  onChange={(e) =>
                    setBannerSettings({ ...bannerSettings, interval: parseInt(e.target.value) || 5000 })
                  }
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* <div>
                <label className="block text-xs text-gray-500 mb-1">Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  value={bannerSettings.expiresAt}
                  onChange={(e) =>
                    setBannerSettings({ ...bannerSettings, expiresAt: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div> */}
            </div>

            {/* Preview */}
            {bannerSettings.enabled && bannerSettings.images.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview (Mobile View)
                </label>
                <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-2 max-w-sm mx-auto">
                  <div className="relative aspect-[3/1] rounded-lg overflow-hidden">
                    <img
                      src={bannerSettings.images[previewIndex]?.url}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                    />
                    {bannerSettings.images.length > 1 && (
                      <>
                        <button
                          onClick={() =>
                            setPreviewIndex((prev) =>
                              prev === 0 ? bannerSettings.images.length - 1 : prev - 1
                            )
                          }
                          className="absolute left-1 top-1/2 -translate-y-1/2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setPreviewIndex((prev) =>
                              (prev + 1) % bannerSettings.images.length
                            )
                          }
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {/* Dots */}
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                          {bannerSettings.images.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setPreviewIndex(idx)}
                              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                idx === previewIndex ? "bg-white" : "bg-white/50"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <button
                onClick={saveBannerSettings}
                disabled={saving}
                className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Banner Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
