import React, { useState, useEffect } from "react";
import {
  LogOut,
  Bell,
  Calendar,
  DollarSign,
  History,
  Info,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { AuthState, MonthlyRecord, Withdrawal, Notification } from "../types";
import LedgerCard from "./LedgerCard";

interface EmployeeDashboardProps {
  auth: AuthState;
  onLogout: () => void;
}

export default function EmployeeDashboard({ auth, onLogout }: EmployeeDashboardProps) {
  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeRecord, setActiveRecord] = useState<MonthlyRecord | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [error, setError] = useState("");

  const employeeId = auth.employee_id || "";

  // 1. Fetch employee records, withdrawals, and notifications
  const fetchData = async () => {
    try {
      const recordsRes = await fetch(`/api/monthly_records/all/${employeeId}`);
      const recordsData = await recordsRes.json();
      setRecords(recordsData);

      // Set active record for the selected month/year
      const found = recordsData.find(
        (r: any) => r.year === selectedYear && r.month === selectedMonth
      );
      if (found) {
        setActiveRecord(found);
      } else {
        // If not found, fetch it specifically to force creation
        const singleRes = await fetch(
          `/api/monthly_records/${employeeId}/${selectedYear}/${selectedMonth}`
        );
        const singleData = await singleRes.json();
        setActiveRecord(singleData);
      }

      const withdrawalsRes = await fetch(`/api/withdrawals/${employeeId}`);
      const withdrawalsData = await withdrawalsRes.json();
      setWithdrawals(withdrawalsData);

      const notifRes = await fetch(`/api/notifications/${employeeId}`);
      const notifData = await notifRes.json();
      setNotifications(notifData);
      setUnreadCount(notifData.filter((n: any) => !n.is_read).length);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("डेटा लोड करने में समस्या हुई।");
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  // 2. Real-time Live Sync via Server-Sent Events (SSE)
  useEffect(() => {
    const sse = new EventSource(`/api/live-sync?employee_id=${employeeId}`);

    sse.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "connected") {
        console.log("Real-time Live Sync active");
        return;
      }

      // Add to notifications and update counts
      setNotifications((prev) => [data, ...prev]);
      setUnreadCount((c) => c + 1);

      // Play subtle tone or trigger vibration if possible
      if ("vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]);
      }

      // Re-trigger global fetch to update stats & ledger card instantly!
      fetchData();
    };

    sse.onerror = (err) => {
      console.warn("SSE connection interrupted, retrying:", err);
    };

    return () => {
      sse.close();
    };
  }, [employeeId, selectedMonth, selectedYear]);

  // 3. Mark all notifications as read
  const handleMarkNotificationsRead = async () => {
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  };

  const toggleNotifDrawer = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      handleMarkNotificationsRead();
    }
  };

  // Filter withdrawals for active month
  const activeWithdrawals = withdrawals.filter((w) => {
    const d = new Date(w.date);
    return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
  });

  // Unique years & months list
  const years = [2026, 2025];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen artistic-flair-bg font-hin-body pb-10">
      
      {/* Header Bar */}
      <header className="bg-[#8B2E2E] text-white border-b border-[#A9772F]/25 sticky top-0 z-40 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <div>
              <h1 className="text-xl font-extrabold font-hin-head tracking-tight leading-tight">
                सनशाइन पगार बुक
              </h1>
              <span className="text-[10px] bg-yellow-400 text-amber-950 font-bold px-1.5 py-0.5 rounded uppercase">
                कर्मचारी पैनल
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={toggleNotifDrawer}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors relative cursor-pointer"
                title="नोटिफिकेशन"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-amber-950 font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#8B2E2E] animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-[#A9772F]/30 shadow-2xl rounded-xl p-4 z-50 text-left text-sm max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-[#A9772F]/10 pb-2 mb-2">
                    <span className="font-bold text-[#8B2E2E]">सूचनाएं (Notifications)</span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-xs text-gray-400 hover:text-[#2B2620]"
                    >
                      बंद करें
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-6">कोई नई सूचना नहीं है</p>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2 rounded text-xs border ${
                            !n.is_read ? "bg-amber-50 border-[#A9772F]/40" : "bg-white border-gray-100"
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold mb-0.5">
                            <span className={n.type === "upad" ? "text-[#8B2E2E]" : "text-[#2F5D42]"}>
                              {n.title}
                            </span>
                            <span className="text-[9px] text-gray-400 font-mono">
                              {new Date(n.created_at).toLocaleTimeString("hi-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-gray-600 leading-tight">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="text-white/80 hover:text-white flex items-center gap-1 text-sm font-bold bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">लॉगआउट</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        
        {/* Welcome Section */}
        <div className="bg-white border border-[#A9772F]/20 p-6 rounded-xl shadow-lg mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-hin-head">
              नमस्ते, <span className="text-[#8B2E2E]">{auth.name}</span>!
            </h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              आईडी: {auth.login_id} • आपका मासिक वेतन: <span className="font-bold">₹{activeRecord ? activeRecord.duty_days * 600 : "0"}</span> (मासिक बेस)
            </p>
          </div>

          {/* Month / Year Filters */}
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-white border border-[#A9772F]/30 rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 min-h-[38px]"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {new Date(2026, m - 1).toLocaleString("hi-IN", { month: "long" })}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-white border border-[#A9772F]/30 rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 min-h-[38px]"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Previous Month Deficit Alert Banner */}
        {activeRecord && activeRecord.carry_forward_in > 0 && (
          <div className="bg-[#FFF5F5] border border-[#8B2E2E]/20 p-4 rounded-xl text-[#8B2E2E] flex items-start gap-3 mb-6 shadow-sm">
            <Info size={20} className="shrink-0 mt-0.5 text-[#8B2E2E]" />
            <div>
              <h4 className="font-bold text-sm">पिछले महीने का नुकसान (Deficit Carry Forward)</h4>
              <p className="text-xs leading-normal mt-0.5">
                पिछले महीने की शेष नकारात्मक राशि <strong>₹{activeRecord.carry_forward_in}</strong> इस महीने के वेतन में से अपने आप काट ली गई है।
              </p>
            </div>
          </div>
        )}

        {/* Main Scorecards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          
          {/* Duty Days */}
          <div className="bg-white border border-[#A9772F]/20 p-4 rounded-xl shadow-md text-center hover:shadow-lg transition-shadow duration-200">
            <span className="text-xs text-gray-500 block mb-1">ड्यूटी दिन (Duty Days)</span>
            <span className="font-mono text-2xl font-bold text-[#2B2620]">
              {activeRecord ? activeRecord.duty_days : "0"}
            </span>
            <span className="text-xs text-gray-400 block mt-1">दिन हाज़िर</span>
          </div>

          {/* Overtime */}
          <div className="bg-white border border-[#A9772F]/20 p-4 rounded-xl shadow-md text-center hover:shadow-lg transition-shadow duration-200">
            <span className="text-xs text-gray-500 block mb-1">ओवरटाइम (Overtime)</span>
            <span className="font-mono text-2xl font-bold text-[#2F5D42]">
              ₹{activeRecord ? activeRecord.overtime_amount : "0"}
            </span>
            <span className="text-xs text-gray-400 block mt-1">अतिरिक्त कमाई</span>
          </div>

          {/* Total Withdrawals */}
          <div className="bg-white border border-[#A9772F]/20 p-4 rounded-xl shadow-md text-center hover:shadow-lg transition-shadow duration-200">
            <span className="text-xs text-gray-500 block mb-1">कुल उपाड़ (Withdrawals)</span>
            <span className="font-mono text-2xl font-bold text-[#8B2E2E]">
              ₹{activeRecord ? activeRecord.total_withdrawals : "0"}
            </span>
            <span className="text-xs text-gray-400 block mt-1">लिया गया एडवांस</span>
          </div>

          {/* Final Salary */}
          <div className="bg-white border border-[#A9772F]/20 p-4 rounded-xl shadow-md text-center hover:shadow-lg transition-shadow duration-200">
            <span className="text-xs text-gray-500 block mb-1">अंतिम सैलरी (Final Payable)</span>
            <span
              className={`font-mono text-2xl font-extrabold block ${
                activeRecord && activeRecord.final_salary < 0 ? "text-[#8B2E2E]" : "text-[#2F5D42]"
              }`}
            >
              ₹{activeRecord ? activeRecord.final_salary : "0"}
            </span>
            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full inline-block mt-1 font-bold">
              {activeRecord && activeRecord.final_salary < 0 ? "ऋण शेष (अगले महीने कटेगा)" : "चुकौती योग्य राशि"}
            </span>
          </div>

        </div>

        {/* Ledger card and lists */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold font-hin-head text-[#A9772F] border-b border-[#A9772F]/20 pb-2 mb-4">
            खाता बही विवरणी (Ledger Summary)
          </h3>

          <LedgerCard
            withdrawals={activeWithdrawals}
            record={activeRecord}
            isAdmin={false}
            lang="hi"
          />
        </div>

        {/* Friendly offline note */}
        <div className="mt-8 text-center text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
          🔒 यह एक सुरक्षित PWA कर्मचारी पैनल है। सभी आंकड़े केवल एडमिन द्वारा अपडेट किए जा सकते हैं। किसी भी विसंगति के लिए एस्टेट मैनेजर से संपर्क करें।
        </div>

      </main>
    </div>
  );
}
