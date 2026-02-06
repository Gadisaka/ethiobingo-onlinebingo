import React, { useEffect, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Eye,
  EyeOff,
  Gift,
  CreditCard,
  Trophy,
  RotateCcw,
  X,
  UserPlus,
  Wallet,
} from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";
import { useAuth } from "../context/AuthContext";
import { useWalletStore } from "../store/walletStore";

// Transaction type display config
const txTypeConfig = {
  GAME_STAKE: {
    title: "Game Entry",
    icon: CreditCard,
    colorClass: "bg-red-500/10 text-red-500",
    amountClass: "text-red-400",
    badge: "GAME",
    badgeClass: "bg-red-500/10 text-red-400",
  },
  GAME_WIN: {
    title: "Game Won",
    icon: Trophy,
    colorClass: "bg-emerald-500/10 text-emerald-500",
    amountClass: "text-emerald-400",
    badge: "WON",
    badgeClass: "bg-emerald-500/10 text-emerald-400",
  },
  SPIN_BONUS: {
    title: "Spin Bonus",
    icon: Gift,
    colorClass: "bg-purple-500/10 text-purple-500",
    amountClass: "text-purple-400",
    badge: "BONUS",
    badgeClass: "bg-purple-500/10 text-purple-400",
  },
  DEPOSIT: {
    title: "Deposit",
    icon: ArrowDownCircle,
    colorClass: "bg-emerald-500/10 text-emerald-500",
    amountClass: "text-emerald-400",
    badge: "COMPLETED",
    badgeClass: "bg-emerald-500/10 text-emerald-400",
  },
  WITHDRAWAL: {
    title: "Withdrawal",
    icon: ArrowUpCircle,
    colorClass: "bg-slate-700/30 text-slate-400",
    amountClass: "text-white",
    badge: "COMPLETED",
    badgeClass: "bg-slate-700/30 text-slate-400",
  },
  REFUND: {
    title: "Refund",
    icon: RotateCcw,
    colorClass: "bg-blue-500/10 text-blue-500",
    amountClass: "text-blue-400",
    badge: "REFUNDED",
    badgeClass: "bg-blue-500/10 text-blue-400",
  },
  ADMIN_ADJUST: {
    title: "Adjustment",
    icon: CreditCard,
    colorClass: "bg-slate-700/30 text-slate-400",
    amountClass: "text-white",
    badge: "ADMIN",
    badgeClass: "bg-slate-700/30 text-slate-400",
  },
  BONUS_REDEEM: {
    title: "Bonus Redeemed",
    icon: Gift,
    colorClass: "bg-orange-500/10 text-orange-500",
    amountClass: "text-orange-400",
    badge: "REDEEMED",
    badgeClass: "bg-orange-500/10 text-orange-400",
  },
  CASHIER_TOPUP: {
    title: "Cashier Top-up",
    icon: UserPlus,
    colorClass: "bg-indigo-500/10 text-indigo-500",
    amountClass: "text-indigo-400",
    badge: "TOP-UP",
    badgeClass: "bg-indigo-500/10 text-indigo-400",
  },
  AGENT_TOPUP: {
    title: "Agent Top-up",
    icon: Wallet,
    colorClass: "bg-cyan-500/10 text-cyan-500",
    amountClass: "text-cyan-400",
    badge: "RECEIVED",
    badgeClass: "bg-cyan-500/10 text-cyan-400",
  },
};

// Format date helper
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
};

export default function WalletModal() {
  const { user } = useAuth();
  const { isOpen, closeWallet } = useWalletStore();
  const [showBalance, setShowBalance] = useState(true);
  const [balance, setBalance] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [availableSpins, setAvailableSpins] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Handle entry/exit animations
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow render before animating in
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && user) {
      const fetchData = async () => {
        // Fetch wallet balance
        try {
          const res = await axios.get(`${API_URL}/api/wallet/me`);
          setBalance(Number(res.data?.balance || 0));
          setBonus(Number(res.data?.bonus || 0));
        } catch (e) {
          console.error("Failed to fetch wallet", e);
          setBalance(Number(user?.balance || 0));
        }

        // Fetch spins
        try {
          const resPoints = await axios.get(`${API_URL}/api/user/points`);
          setAvailableSpins(Number(resPoints.data?.spins?.available || 0));
        } catch (e) {
          console.error("Failed to fetch spin data", e);
        }

        // Fetch transactions
        try {
          setLoadingTx(true);
          const resTx = await axios.get(
            `${API_URL}/api/wallet/transactions?limit=20`
          );
          setTransactions(resTx.data?.transactions || []);
        } catch (e) {
          console.error("Failed to fetch transactions", e);
          setTransactions([]);
        } finally {
          setLoadingTx(false);
        }
      };
      fetchData();
    }
  }, [isOpen, user]);

  const handleClose = () => {
    setIsVisible(false);
    // Wait for animation to finish before unmounting/hiding in store
    setTimeout(() => closeWallet(), 300);
  };

  if (!isOpen && !isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end isolate">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Slide-up Card */}
      <div
        className={`relative z-10 w-full h-[90vh] bg-slate-950 rounded-t-[2.5rem] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden transition-transform duration-300 ease-out transform ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header with Close Button */}
        <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="w-12" /> {/* Spacer */}
          <div className="w-12 h-1.5 bg-slate-800 rounded-full absolute left-1/2 -translate-x-1/2 top-3" />
          <h1 className="text-lg font-bold text-white mt-2">My Wallet</h1>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-full hover:bg-white/10 text-slate-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="h-full overflow-y-auto pb-24 px-6 pt-4 space-y-6">
          {/* Main Balance Card */}
          <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-slate-400 text-sm font-medium">
                Cash Balance (Withdrawable)
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {showBalance ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="text-4xl font-black text-white mb-8 relative z-10 tracking-tight">
              <span className="text-2xl text-slate-500 mr-1">ETB</span>
              {showBalance ? balance.toFixed(2) : "****"}
            </div>

            <div className="flex gap-3 relative z-10">
              <button className="flex-1 bg-[#ffd700] hover:bg-[#e6c200] text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-yellow-500/20">
                <ArrowDownCircle className="w-5 h-5" /> Deposit
              </button>
              <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/5">
                <ArrowUpCircle className="w-5 h-5" /> Withdraw
              </button>
            </div>
          </div>

          {/* Bonus Card */}
          <div className="bg-gradient-to-br from-[#3d2b1f] to-[#1f1612] rounded-3xl p-6 border border-orange-500/20 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 text-orange-500/5 transform group-hover:scale-110 transition-transform duration-700">
              <Gift className="w-32 h-32" />
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <span className="text-orange-200/80 text-sm font-medium">
                  Bonus Balance
                </span>
                <div className="bg-orange-500/20 p-1.5 rounded-lg">
                  <Gift className="w-4 h-4 text-orange-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-2 tracking-tight">
                <span className="text-xl text-orange-500/60 mr-1">ETB</span>
                {showBalance ? bonus.toFixed(2) : "****"}
              </div>
              <button className="flex items-center gap-2 text-orange-300/80 text-sm font-medium hover:text-orange-300 transition group-hover:translate-x-1">
                Redeem rewards <span className="text-lg">→</span>
              </button>
            </div>
          </div>

          {/* Spin Bonus Card */}
          <div className="bg-gradient-to-br from-[#13221f] to-[#0b1412] rounded-3xl p-6 border border-emerald-500/20 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 text-emerald-500/10 transform group-hover:scale-110 transition-transform duration-700">
              <ArrowDownCircle className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="bg-emerald-500/20 p-1.5 rounded-lg">
                  <Gift className="w-4 h-4 text-emerald-400" />
                </div>
              </div>

              <div className="text-3xl text-emerald-200/80">
                Available spins:{" "}
                <span className="font-bold">{availableSpins}</span>
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4 ml-1">
              Recent Activity
            </h3>
            <div className="space-y-3">
              {loadingTx ? (
                <div className="text-center py-8 text-slate-500">
                  Loading transactions...
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No transactions yet
                </div>
              ) : (
                transactions.map((tx) => {
                  const config =
                    txTypeConfig[tx.type] || txTypeConfig.ADMIN_ADJUST;
                  const IconComponent = config.icon;
                  const isPositive = tx.amount > 0;

                  return (
                    <div
                      key={tx.id}
                      className="bg-[#161b26]/80 backdrop-blur-sm p-4 rounded-2xl flex items-center justify-between border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.colorClass}`}
                        >
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="font-bold text-white">
                            {config.title}
                          </div>
                          <div className="text-xs text-slate-500 font-medium mt-0.5">
                            {formatDate(tx.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-bold text-lg ${config.amountClass}`}
                        >
                          {isPositive ? "+" : ""}
                          {Math.abs(tx.amount).toFixed(2)}
                        </div>
                        <div
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${config.badgeClass}`}
                        >
                          {config.badge}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
