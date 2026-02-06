import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Gamepad2,
  Users,
  ArrowRightLeft,
  UserCog,
  Wallet,
  Bell,
  Settings,
  Megaphone,
  LogOut,
  Menu,
  X,
  BarChart3,
  Trophy,
  Joystick,
  QrCode,
} from "lucide-react";
import clsx from "clsx";
import QRCodeModal from "../components/QRCodeModal";
import axios from "axios";
import { API_URL } from "../constant";

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [cashierCode, setCashierCode] = useState(null);

  // Fetch cashier code for QR display
  useEffect(() => {
    const fetchCashierCode = async () => {
      if (user?.role === "cashier") {
        try {
          const response = await axios.get(
            `${API_URL}/api/cashier-subscription/my-code/${user.id || user._id}`
          );
          setCashierCode(response.data.cashierCode);
        } catch (err) {
          console.error("Error fetching cashier code:", err);
        }
      }
    };
    fetchCashierCode();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Games", path: "/games", icon: Gamepad2 },
    { name: "Agents", path: "/agents", icon: UserCog, role: "admin" },
    { name: "All Cashiers", path: "/all-cashiers", icon: Users, role: "admin" },
    { name: "Cashiers", path: "/cashiers", icon: Wallet, role: "agent" },
    { name: "Reports", path: "/reports", icon: BarChart3 },
    { name: "Settings", path: "/settings", icon: Settings, role: "admin" },
    // {
    //   name: "Notifications",
    //   path: "/notifications",
    //   icon: Bell,
    //   role: "admin",
    // },
    // { name: "Ads", path: "/ads", icon: Megaphone, role: "admin" },
  ];

  // Filter items based on role
  const filteredNavItems = navItems.filter(
    (item) => !item.role || item.role === user?.role
  );

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transition-transform duration-200 ease-in-out",
          // On large screens, always show sidebar (translate-0), ignore mobile toggle
          "lg:translate-x-0",
          // On mobile, toggle visibility based on state
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b">
            <h1 className="text-2xl font-bold text-primary">Bingo</h1>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  )
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.username}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm lg:hidden">
          <div className="h-16 flex items-center px-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-4 text-lg font-semibold text-gray-900">
              {navItems.find((i) => i.path === location.pathname)?.name ||
                "Admin"}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Floating Buttons for Cashiers */}
      {user?.role === "cashier" && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          {/* QR Code Button - Always visible */}
          <button
            onClick={() => setShowQRModal(true)}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-violet-500 px-5 py-4 text-white font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 transition-all duration-200"
          >
            <QrCode className="w-6 h-6" />
            <span className="hidden sm:inline">QR</span>
          </button>
          
          {/* Game Button */}
          <button
            onClick={() => navigate("/game")}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 text-white font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transition-all duration-200"
          >
            <Joystick className="w-6 h-6" />
            <span className="hidden sm:inline">Game</span>
          </button>
        </div>
      )}

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        cashierCode={cashierCode}
        cashierName={user?.name || user?.username}
      />
    </div>
  );
};

export default MainLayout;

