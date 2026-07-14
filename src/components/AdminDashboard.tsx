import React, { useState, useEffect } from "react";
import {
  LogOut,
  Plus,
  Users,
  UserPlus,
  Calendar,
  DollarSign,
  Send,
  Trash2,
  Check,
  AlertTriangle,
  History,
  Info,
  Sparkles,
  Share2,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  TrendingDown,
} from "lucide-react";
import { AuthState, Employee, MonthlyRecord, Withdrawal, Notification, Attendance } from "../types";
import LedgerCard from "./LedgerCard";

interface AdminDashboardProps {
  auth: AuthState;
  onLogout: () => void;
}

export default function AdminDashboard({ auth, onLogout }: AdminDashboardProps) {
  // Application Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [activeRecord, setActiveRecord] = useState<MonthlyRecord | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<Notification[]>([]);

  // Selection States
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Employee Add/Edit Modals & Form States
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [empForm, setEmpForm] = useState({
    id: "",
    name: "",
    mobile: "",
    employee_login_id: "",
    password: "",
    monthly_salary: "",
  });

  // Action Form States
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [recordForm, setRecordForm] = useState({
    duty_days: "",
    overtime_amount: "",
  });

  // Gemini Command Bar States
  const [geminiText, setGeminiText] = useState("");
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiResponse, setGeminiResponse] = useState<any>(null); // holds query response or write confirmation

  // UI tabs
  const [activeTab, setActiveTab] = useState<"ledger" | "employees" | "attendance" | "notifications">("ledger");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Attendance tracker view states
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);

  // Fetch all basic elements
  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      setEmployees(data);
      if (data.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActiveRecordAndWithdrawals = async () => {
    if (!selectedEmployeeId) return;
    try {
      // 1. Fetch record
      const recRes = await fetch(
        `/api/monthly_records/${selectedEmployeeId}/${selectedYear}/${selectedMonth}`
      );
      const recData = await recRes.json();
      setActiveRecord(recData);
      setRecordForm({
        duty_days: String(recData.duty_days),
        overtime_amount: String(recData.overtime_amount),
      });

      // 2. Fetch withdrawals
      const withRes = await fetch(`/api/withdrawals/${selectedEmployeeId}`);
      const withData = await withRes.json();
      setWithdrawals(withData);

      // 3. Fetch attendance
      const attRes = await fetch(`/api/attendance/${selectedEmployeeId}`);
      const attData = await attRes.json();
      setAttendance(attData);

      // 4. Fetch notification logs
      const notifRes = await fetch(`/api/notifications/${selectedEmployeeId}`);
      const notifData = await notifRes.json();
      setNotificationLogs(notifData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchActiveRecordAndWithdrawals();
  }, [selectedEmployeeId, selectedMonth, selectedYear]);

  // ----------------------------------------------------
  // BUSINESS LOGIC: CRUD EMPLOYEES
  // ----------------------------------------------------
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg("કર્મચારી સફળતાપૂર્વક ઉમેરાયો!");
        fetchEmployees();
        setShowAddEmployee(false);
        setEmpForm({
          id: "",
          name: "",
          mobile: "",
          employee_login_id: "",
          password: "",
          monthly_salary: "",
        });
        setTimeout(() => setStatusMsg(""), 3000);
      } else {
        setErrorMsg(data.message || "ઉમેરવામાં નિષ્ફળતા મળી.");
      }
    } catch (err) {
      setErrorMsg("કનેક્શન નિષ્ફળ.");
    }
  };

  const openEditEmployee = (emp: Employee) => {
    setEmpForm({
      id: emp.id,
      name: emp.name,
      mobile: emp.mobile,
      employee_login_id: emp.employee_login_id,
      password: "", // empty for editing password option
      monthly_salary: String(emp.monthly_salary),
    });
    setShowEditEmployee(true);
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      const res = await fetch(`/api/employees/${empForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg("કર્મચારીની વિગતો સફળતાપૂર્વક અપડેટ થઈ!");
        fetchEmployees();
        fetchActiveRecordAndWithdrawals();
        setShowEditEmployee(false);
        setTimeout(() => setStatusMsg(""), 3000);
      } else {
        setErrorMsg(data.message || "અપડેટ નિષ્ફળ.");
      }
    } catch (err) {
      setErrorMsg("કનેક્શન નિષ્ફળ.");
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!window.confirm("શું તમે આ કર્મચારીને સદંતર કાઢી નાખવા માંગો છો? આનાથી તેમનો આખો હિસાબ ડિલીટ થઈ જશે.")) return;
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (res.ok) {
        setStatusMsg("કર્મચારી કાઢી નાખવામાં આવ્યો!");
        setEmployees((prev) => prev.filter((e) => e.id !== id));
        setSelectedEmployeeId("");
        setTimeout(() => setStatusMsg(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ----------------------------------------------------
  // BUSINESS LOGIC: LEGER UPDATES (DUTY DAYS / OVERTIME / UPAD)
  // ----------------------------------------------------
  const handleUpdateRecord = async () => {
    if (!selectedEmployeeId || !activeRecord) return;
    try {
      const res = await fetch("/api/monthly_records/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: selectedEmployeeId,
          year: selectedYear,
          month: selectedMonth,
          duty_days: Number(recordForm.duty_days),
          overtime_amount: Number(recordForm.overtime_amount),
        }),
      });
      if (res.ok) {
        setStatusMsg("પગાર પત્રક અપડેટ થયું!");
        fetchActiveRecordAndWithdrawals();
        setTimeout(() => setStatusMsg(""), 2000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) return;
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: selectedEmployeeId,
          date: withdrawalForm.date,
          amount: Number(withdrawalForm.amount),
          note: withdrawalForm.note,
          created_by: "admin",
        }),
      });
      if (res.ok) {
        setStatusMsg("નવો ઉપાડ ઉમેરાયો અને લાઈવ પુશ મોકલાયો!");
        fetchActiveRecordAndWithdrawals();
        setWithdrawalForm({
          amount: "",
          note: "",
          date: new Date().toISOString().split("T")[0],
        });
        setTimeout(() => setStatusMsg(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWithdrawal = async (id: string) => {
    if (!window.confirm("શું તમે આ ઉપાડની એન્ટ્રી કાઢી નાખવા માંગો છો?")) return;
    try {
      const res = await fetch(`/api/withdrawals/${id}`, { method: "DELETE" });
      if (res.ok) {
        setStatusMsg("ઉપાડ કાઢી નાખવામાં આવ્યો!");
        fetchActiveRecordAndWithdrawals();
        setTimeout(() => setStatusMsg(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ----------------------------------------------------
  // BUSINESS LOGIC: ATTENDANCE TRACKER
  // ----------------------------------------------------
  const handleMarkAttendance = async (empId: string, status: "present" | "absent") => {
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: empId,
          date: attendanceDate,
          status,
        }),
      });
      if (res.ok) {
        // refresh current employee stats if they are selected
        if (empId === selectedEmployeeId) {
          fetchActiveRecordAndWithdrawals();
        }
        // Force refresh local attendance state list
        const updated = attendance.filter((a) => a.employee_id === empId && a.date === attendanceDate);
        if (updated.length > 0) {
          setAttendance((prev) =>
            prev.map((a) => (a.employee_id === empId && a.date === attendanceDate ? { ...a, status } : a))
          );
        } else {
          setAttendance((prev) => [...prev, { id: `${empId}-temp`, employee_id: empId, date: attendanceDate, status }]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getAttendanceStatus = (empId: string) => {
    const record = attendance.find((a) => a.employee_id === empId && a.date === attendanceDate);
    // If not logged, find from fetch or return null
    return record ? record.status : null;
  };

  // ----------------------------------------------------
  // BUSINESS LOGIC: GEMINI COMMAND BAR
  // ----------------------------------------------------
  const handleGeminiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geminiText.trim()) return;
    setGeminiLoading(true);
    setGeminiResponse(null);

    try {
      const res = await fetch("/api/gemini/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: geminiText }),
      });
      const data = await res.json();
      setGeminiResponse(data);
    } catch (err) {
      console.error(err);
      setGeminiResponse({
        action: "clarify",
        message: "ભૂલ આવી છે. કૃપા કરીને ફરી ટ્રાય કરો.",
      });
    } finally {
      setGeminiLoading(false);
    }
  };

  const handleConfirmGeminiWrite = async () => {
    if (!geminiResponse) return;
    setGeminiLoading(true);

    try {
      const res = await fetch("/api/gemini/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiResponse),
      });

      if (res.ok) {
        setStatusMsg("કમાન્ડ બારની એન્ટ્રી સફળતાપૂર્વક ઉમેરાઈ ગઈ!");
        setGeminiText("");
        setGeminiResponse(null);
        fetchActiveRecordAndWithdrawals();
        setTimeout(() => setStatusMsg(""), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeminiLoading(false);
    }
  };

  // ----------------------------------------------------
  // BUSINESS LOGIC: WHATSAPP LEDGER EXPORT (html2canvas)
  // ----------------------------------------------------
  const handleWhatsAppExport = async () => {
    const selectedEmp = employees.find((e) => e.id === selectedEmployeeId);
    if (!selectedEmp) return;

    // We target our signature ledger card container
    const ledgerEl = document.getElementById("ledger-card-wrapper");
    if (!ledgerEl) {
      alert("લેજર કાર્ડ મળ્યું નથી.");
      return;
    }

    try {
      setStatusMsg("ઈમેજ રીપોર્ટ જનરેટ થઈ રહ્યો છે...");
      if ((window as any).html2canvas) {
        const canvas = await (window as any).html2canvas(ledgerEl, {
          backgroundColor: "#F3EBD8",
          useCORS: true,
          scale: 2, // higher resolution
        });
        const dataUrl = canvas.toDataURL("image/png");

        const messageText = `☀️ *સનશાઇન પગાર બુક હિસાબ રીપોર્ટ* ☀️\n\n*કર્મચારી:* ${selectedEmp.name} (${selectedEmp.employee_login_id})\n*મોબાઇલ:* ${selectedEmp.mobile}\n*મહિનો/વર્ષ:* ${selectedMonth}/${selectedYear}\n\n*કુલ હાજરી:* ${activeRecord?.duty_days} દિવસ\n*ઓવરટાઇમ:* ₹${activeRecord?.overtime_amount}\n*ગયા માસની કપાત:* ₹${activeRecord?.carry_forward_in}\n*કુલ ઉપાડ:* ₹${activeRecord?.total_withdrawals}\n*ચૂકવવાપાત્ર આખરી પગાર:* ₹${activeRecord?.final_salary}\n\nઆભાર,\nસનશાઇન પોલીફિલ્મ 🏭`;

        // Share via Web Share API if mobile is capable
        if (navigator.share && navigator.canShare) {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], `Ledger_${selectedEmp.employee_login_id}.png`, { type: "image/png" });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: "Sunshine Pagar Book",
              text: messageText,
              files: [file],
            });
            setStatusMsg("રીપોર્ટ સફળતાપૂર્વક શેર થયો!");
            setTimeout(() => setStatusMsg(""), 3000);
            return;
          }
        }

        // WhatsApp Web / App Deep link fallback
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
          messageText + "\n\n(કૃપા કરીને પત્રકની ફોટો ઇમેજ પણ શેર કરો)"
        )}`;
        window.open(waUrl, "_blank");
        setStatusMsg("WhatsApp ઓપન થયું છે!");
        setTimeout(() => setStatusMsg(""), 3000);
      } else {
        alert("html2canvas લોડ થઈ રહ્યું છે, કૃપા કરીને થોડી વાર પછી ફરી પ્રયાસ કરો.");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("શેરિંગમાં ભૂલ આવી.");
    }
  };

  const selectedEmpDetails = employees.find((e) => e.id === selectedEmployeeId);
  const years = [2026, 2025];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen artistic-flair-bg font-guj-body pb-10">
      
      {/* Top Header Bar */}
      <header className="bg-[#8B2E2E] text-white border-b border-[#A9772F]/25 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <div>
              <h1 className="text-xl font-extrabold font-guj-head tracking-tight leading-tight">
                સનશાઇન પગાર બુક
              </h1>
              <span className="text-[10px] bg-[#A9772F] text-white font-bold px-1.5 py-0.5 rounded uppercase">
                એડમિન પેનલ (Gujarati UI)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              className="text-white/80 hover:text-white flex items-center gap-1 text-sm font-bold bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              <span>પ્રસ્થાન (Logout)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 mt-6">
        
        {/* Status / Error Toast notification */}
        {statusMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-600/30 text-emerald-800 text-sm rounded-lg font-bold flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-[#8B2E2E]/30 text-[#8B2E2E] text-sm rounded-lg font-bold">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-[#A9772F]/20 mb-6 bg-white/30 backdrop-blur-sm p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "ledger"
                ? "bg-[#A9772F] text-white shadow-md"
                : "text-[#2B2620]/70 hover:text-[#2B2620] hover:bg-white/40"
            }`}
          >
            📊 પગાર અને ઉપાડ (Ledger)
          </button>
          <button
            onClick={() => setActiveTab("employees")}
            className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "employees"
                ? "bg-[#A9772F] text-white shadow-md"
                : "text-[#2B2620]/70 hover:text-[#2B2620] hover:bg-white/40"
            }`}
          >
            👥 કર્મચારીઓ મેનેજ કરો
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "attendance"
                ? "bg-[#A9772F] text-white shadow-md"
                : "text-[#2B2620]/70 hover:text-[#2B2620] hover:bg-white/40"
            }`}
          >
            📅 દૈનિક હાજરીપત્રક
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "notifications"
                ? "bg-[#A9772F] text-white shadow-md"
                : "text-[#2B2620]/70 hover:text-[#2B2620] hover:bg-white/40"
            }`}
          >
            🔔 નોટિફિકેશન લોગ
          </button>
        </div>

        {/* TAB 1: LEDGER (Salary & withdrawals, Gemini Command bar, Share) */}
        {activeTab === "ledger" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Sidebar: Controls & Selection */}
            <div className="space-y-6 lg:col-span-1">
              
              {/* Select Employee Card */}
              <div className="bg-white border border-[#A9772F]/20 p-5 rounded-xl shadow-lg">
                <h3 className="font-bold text-base mb-3 text-[#A9772F] flex items-center gap-1.5 font-sans">
                  <Users size={18} />
                  <span>કર્મચારી અને મહિનો પસંદ કરો</span>
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">કર્મચારી (Employee)</label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 min-h-[44px]"
                    >
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.employee_login_id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">મહિનો</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 min-h-[44px]"
                      >
                        {months.map((m) => (
                          <option key={m} value={m}>
                            {new Date(2026, m - 1).toLocaleString("gu-IN", { month: "long" })}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">વર્ષ</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 min-h-[44px]"
                      >
                        {years.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {selectedEmpDetails && (
                  <div className="mt-4 pt-3 border-t border-[#A9772F]/15 text-xs text-[#2B2620]/70 space-y-1 bg-amber-50/40 p-3 rounded-lg">
                    <p>📱 મોબાઈલ: <span className="font-bold">{selectedEmpDetails.mobile}</span></p>
                    <p>💼 મૂળ માસિક પગાર: <span className="font-bold font-mono">₹{selectedEmpDetails.monthly_salary}</span> (૨૬ દિવસનો)</p>
                    <p>📊 દૈનિક રોજ: <span className="font-bold font-mono">₹{Math.round(selectedEmpDetails.monthly_salary / 26)}</span></p>
                  </div>
                )}
              </div>

              {/* Attendance days & Overtime Quick Updates */}
              <div className="bg-white border border-[#A9772F]/20 p-5 rounded-xl shadow-lg">
                <h3 className="font-bold text-base mb-3 text-[#A9772F] flex items-center gap-1.5 font-sans">
                  <DollarSign size={18} />
                  <span>પગાર અને હાજરી એન્ટ્રી</span>
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">હાજર દિવસો (Duty Days)</label>
                    <input
                      type="number"
                      value={recordForm.duty_days}
                      onChange={(e) => setRecordForm({ ...recordForm, duty_days: e.target.value })}
                      className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 min-h-[44px]"
                      placeholder="દા.ત. 24"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 italic">
                      * રવિવાર/બુધવાર બાદ કરતાં સૂચવેલ હાજરી: {activeRecord?.duty_days} દિવસ
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">ઓવરટાઇમ રકમ (Overtime ₹)</label>
                    <input
                      type="number"
                      value={recordForm.overtime_amount}
                      onChange={(e) => setRecordForm({ ...recordForm, overtime_amount: e.target.value })}
                      className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 min-h-[44px]"
                      placeholder="દા.ત. 1500"
                    />
                  </div>

                  <button
                    onClick={handleUpdateRecord}
                    className="w-full bg-[#2F5D42] hover:bg-[#8B2E2E] text-white font-bold py-2.5 px-4 rounded-lg shadow-md transition-all cursor-pointer text-xs border border-[#2F5D42]/20"
                  >
                    સેવ કરો અને રી-કેલ્ક્યુલેટ કરો
                  </button>
                </div>
              </div>

              {/* Upad / Advance Withdrawal Entry */}
              <div className="bg-white border border-[#A9772F]/20 p-5 rounded-xl shadow-lg">
                <h3 className="font-bold text-base mb-3 text-[#A9772F] flex items-center gap-1.5 font-sans">
                  <TrendingDown size={18} />
                  <span>ઉપાડ ઉમેરો (Debit Advance)</span>
                </h3>

                <form onSubmit={handleAddWithdrawal} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">તારીખ (Date)</label>
                    <input
                      type="date"
                      required
                      value={withdrawalForm.date}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, date: e.target.value })}
                      className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">રકમ (Amount ₹)</label>
                    <input
                      type="number"
                      required
                      value={withdrawalForm.amount}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                      className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 min-h-[44px]"
                      placeholder="દા.ત. 2000"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">નોંધ (Note / Reason)</label>
                    <input
                      type="text"
                      value={withdrawalForm.note}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, note: e.target.value })}
                      className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 min-h-[44px]"
                      placeholder="દા.ત. ઘર ખર્ચ માટે, એડવાન્સ"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#8B2E2E] hover:bg-[#A9772F] text-white font-bold py-2.5 px-4 rounded-lg shadow-md transition-all cursor-pointer text-xs"
                  >
                    ઉપાડ નોંધો (Add Withdrawal)
                  </button>
                </form>
              </div>

            </div>

            {/* Right Side: Ledger view, Gemini assistant, export report */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Gemini Natural Language Command Bar */}
              <div className="bg-white border border-[#A9772F]/20 p-5 rounded-xl shadow-lg">
                <div className="flex items-center justify-between mb-3 border-b border-[#A9772F]/10 pb-2">
                  <h3 className="font-extrabold text-[#A9772F] flex items-center gap-2 text-base font-guj-head">
                    <Sparkles className="animate-pulse text-[#A9772F]" size={18} />
                    <span>Gemini AI નેચરલ કમાન્ડ બાર</span>
                  </h3>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase font-sans">
                    Smart Voice/Text Agent
                  </span>
                </div>

                <form onSubmit={handleGeminiSubmit} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={geminiText}
                    onChange={(e) => setGeminiText(e.target.value)}
                    placeholder="દા.ત. 'Kaushik ko 5000 upad diya' અથવા 'Sanjay ko total upad kitna mila?'"
                    className="flex-1 bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 transition-all font-sans min-h-[44px]"
                  />
                  <button
                    type="submit"
                    disabled={geminiLoading}
                    className="bg-[#A9772F] hover:bg-[#8B2E2E] text-white px-5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md"
                  >
                    {geminiLoading ? "પ્રોસેસ ચાલુ..." : "મોકલો"}
                  </button>
                </form>

                {/* Gemini Response Panel / Confirmation Dialog Card */}
                {geminiResponse && (
                  <div className="p-3 border-2 border-[#A9772F] bg-amber-50/40 rounded-sm text-sm space-y-3 animation-fade-in text-left">
                    {geminiResponse.action === "reply" && (
                      <div>
                        <p className="font-bold text-[#A9772F]">🤖 Gemini AI નો ઉત્તર:</p>
                        <p className="text-[#2B2620] mt-1 italic font-sans text-sm bg-white p-2.5 rounded border border-[#A9772F]/20">
                          "{geminiResponse.message}"
                        </p>
                      </div>
                    )}

                    {geminiResponse.action === "clarify" && (
                      <div>
                        <p className="font-bold text-[#8B2E2E]">⚠️ વિગત સ્પષ્ટ કરો:</p>
                        <p className="text-gray-700 mt-1">{geminiResponse.message}</p>
                      </div>
                    )}

                    {geminiResponse.action === "write" && (
                      <div className="space-y-3">
                        <div className="p-3 bg-white border border-[#A9772F]/40 rounded">
                          <p className="font-extrabold text-[#8B2E2E] flex items-center gap-1">
                            <AlertTriangle size={16} />
                            <span>ખાતા વહી કન્ફર્મેશન પત્રક:</span>
                          </p>
                          <div className="mt-2 text-xs space-y-1 font-sans">
                            <p>• કર્મચારી: <strong>{geminiResponse.employee_name} ({geminiResponse.employee_login_id})</strong></p>
                            <p>• એન્ટ્રીનો પ્રકાર: <strong>
                              {geminiResponse.operation === "add_withdrawal" ? "નવો ઉપાડ (Withdrawal)" : 
                               geminiResponse.operation === "add_overtime" ? "ઓવરટાઇમ ઉમેરો" : "ડ્યુટી દિવસ અપડેટ"}
                            </strong></p>
                            <p>• રકમ / દિવસ: <strong className="font-mono text-[#8B2E2E] text-sm">
                              {geminiResponse.operation === "update_duty_days" ? `${geminiResponse.amount} દિવસ` : `₹${geminiResponse.amount}`}
                            </strong></p>
                            {geminiResponse.note && <p>• નોંધ: <strong>{geminiResponse.note}</strong></p>}
                            <p>• મહિનો/વર્ષ: <strong>{geminiResponse.month || 7}/{geminiResponse.year || 2026}</strong></p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleConfirmGeminiWrite}
                            className="bg-[#2F5D42] hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-sm border-2 border-[#2B2620] text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Check size={14} />
                            <span>હા, એન્ટ્રી ઉમેરો (હા)</span>
                          </button>
                          <button
                            onClick={() => setGeminiResponse(null)}
                            className="bg-[#8B2E2E] hover:bg-red-800 text-white font-bold py-2 px-5 rounded-sm border-2 border-[#2B2620] text-xs cursor-pointer"
                          >
                            ના, રદ કરો
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Signature Ledger Card Container */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-extrabold text-[#8B2E2E] font-guj-head">
                    હિસાબ ખાતાવહી રિપોર્ટ (Ledger Card)
                  </h3>

                  {/* Share button */}
                  <button
                    onClick={handleWhatsAppExport}
                    className="bg-[#A9772F] hover:bg-[#8B2E2E] text-[#F3EBD8] font-bold py-1.5 px-3.5 rounded-sm border-2 border-[#2B2620] shadow-[2px_2px_0px_#2B2620] text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Share2 size={14} />
                    <span>WhatsApp અહેવાલ</span>
                  </button>
                </div>

                {/* Ledger card wrapper for html2canvas export */}
                <div id="ledger-card-wrapper" className="p-1">
                  <LedgerCard
                    withdrawals={withdrawals.filter((w) => {
                      const d = new Date(w.date);
                      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
                    })}
                    record={activeRecord}
                    onDeleteWithdrawal={handleDeleteWithdrawal}
                    isAdmin={true}
                    lang="gu"
                  />
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: MANAGE EMPLOYEES (Add/Edit/Delete) */}
        {activeTab === "employees" && (
          <div className="bg-[#FDFBF7] border-2 border-[#2B2620] p-6 rounded-sm shadow-[4px_4px_0px_#2B2620] text-left">
            <div className="flex items-center justify-between border-b-2 border-[#2B2620]/10 pb-3 mb-6">
              <h3 className="text-xl font-bold text-[#8B2E2E] flex items-center gap-2">
                <Users size={22} />
                <span>કર્મચારીઓનું સંચાલન (Manage Employees)</span>
              </h3>
              <button
                onClick={() => {
                  setEmpForm({
                    id: "",
                    name: "",
                    mobile: "",
                    employee_login_id: "",
                    password: "",
                    monthly_salary: "",
                  });
                  setShowAddEmployee(true);
                }}
                className="bg-[#8B2E2E] hover:bg-[#A9772F] text-white font-bold py-2 px-4 rounded-sm border-2 border-[#2B2620] shadow-[2px_2px_0px_#2B2620] text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={15} />
                <span>નવો કર્મચારી ઉમેરો</span>
              </button>
            </div>

            {/* Employee Table */}
            <div className="overflow-x-auto border-2 border-[#2B2620] rounded-sm bg-white">
              <table className="w-full text-sm font-sans">
                <thead className="bg-[#F2EDE2] border-b-2 border-[#2B2620] text-[#2B2620] font-bold text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">કર્મચારી આઈડી</th>
                    <th className="px-4 py-3 text-left">નામ</th>
                    <th className="px-4 py-3 text-left">મોબાઇલ</th>
                    <th className="px-4 py-3 text-right">માસિક પગાર (૨૬ દિવસ)</th>
                    <th className="px-4 py-3 text-center">કાર્યવાહી</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-gray-200">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-[#8B2E2E]">{emp.employee_login_id}</td>
                      <td className="px-4 py-3 font-bold text-gray-800">{emp.name}</td>
                      <td className="px-4 py-3 font-mono text-gray-600">{emp.mobile}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#2F5D42]">₹{emp.monthly_salary}</td>
                      <td className="px-4 py-3 text-center space-x-2">
                        <button
                          onClick={() => openEditEmployee(emp)}
                          className="bg-amber-100 text-[#A9772F] px-2.5 py-1 text-xs border border-[#A9772F]/40 rounded hover:bg-amber-200 transition-colors cursor-pointer"
                        >
                          બદલો (Edit)
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="bg-red-50 text-[#8B2E2E] px-2.5 py-1 text-xs border border-[#8B2E2E]/40 rounded hover:bg-red-100 transition-colors cursor-pointer"
                        >
                          ડિલીટ
                        </button>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">
                        કોઈ કર્મચારી ઉમેરેલ નથી.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* MODAL: ADD EMPLOYEE */}
            {showAddEmployee && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white border border-[#A9772F]/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <h4 className="font-extrabold text-lg text-[#A9772F] border-b border-[#A9772F]/10 pb-2 mb-4 font-guj-head">
                    👤 નવો કર્મચારી ઉમેરો
                  </h4>
                  <form onSubmit={handleAddEmployee} className="space-y-4 text-sm font-sans">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">પૂરૂં નામ (Full Name)</label>
                      <input
                        type="text"
                        required
                        value={empForm.name}
                        onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                        className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20"
                        placeholder="દા.ત. રમેશભાઈ પટેલ"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">મોબાઇલ નંબર (Mobile)</label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={empForm.mobile}
                        onChange={(e) => setEmpForm({ ...empForm, mobile: e.target.value })}
                        className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20"
                        placeholder="દા.ત. 9876543210"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">કર્મચારી લોગીન આઈડી (EMP ID)</label>
                      <input
                        type="text"
                        required
                        value={empForm.employee_login_id}
                        onChange={(e) => setEmpForm({ ...empForm, employee_login_id: e.target.value.toUpperCase() })}
                        className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 uppercase"
                        placeholder="દા.ત. EMP104"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">પાસવર્ડ (Password)</label>
                      <input
                        type="password"
                        required
                        value={empForm.password}
                        onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                        className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20"
                        placeholder="ન્યૂનતમ ૬ અક્ષર"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">માસિક બેઝ પગાર (Monthly Salary ₹)</label>
                      <input
                        type="number"
                        required
                        value={empForm.monthly_salary}
                        onChange={(e) => setEmpForm({ ...empForm, monthly_salary: e.target.value })}
                        className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20"
                        placeholder="દા.ત. 15000"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-3">
                      <button
                        type="submit"
                        className="bg-[#2F5D42] hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-lg text-xs cursor-pointer shadow-md transition-all"
                      >
                        સેવ કરો
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddEmployee(false)}
                        className="bg-gray-100 hover:bg-gray-200 text-[#2B2620] font-bold py-2.5 px-5 rounded-lg text-xs cursor-pointer transition-all"
                      >
                        રદ કરો
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL: EDIT EMPLOYEE */}
            {showEditEmployee && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white border border-[#A9772F]/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <h4 className="font-extrabold text-lg text-[#A9772F] border-b border-[#A9772F]/10 pb-2 mb-4 font-guj-head">
                    📝 કર્મચારી વિગતો બદલો
                  </h4>
                  <form onSubmit={handleEditEmployee} className="space-y-4 text-sm font-sans">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">નામ</label>
                      <input
                        type="text"
                        required
                        value={empForm.name}
                        onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                        className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">મોબાઇલ</label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={empForm.mobile}
                        onChange={(e) => setEmpForm({ ...empForm, mobile: e.target.value })}
                        className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">નવો પાસવર્ડ (બદલવો હોય તો જ લખો)</label>
                      <input
                        type="password"
                        value={empForm.password}
                        onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                        className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20"
                        placeholder="પાસવર્ડ યથાવત રાખવા ખાલી છોડો"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">માસિક પગાર (₹)</label>
                      <input
                        type="number"
                        required
                        value={empForm.monthly_salary}
                        onChange={(e) => setEmpForm({ ...empForm, monthly_salary: e.target.value })}
                        className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-3">
                      <button
                        type="submit"
                        className="bg-[#2F5D42] hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-lg text-xs cursor-pointer shadow-md transition-all"
                      >
                        અપડેટ કરો
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditEmployee(false)}
                        className="bg-gray-100 hover:bg-gray-200 text-[#2B2620] font-bold py-2.5 px-5 rounded-lg text-xs cursor-pointer transition-all"
                      >
                        રદ કરો
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* TAB 3: DAILY ATTENDANCE LOG (Attendance tracking view) */}
        {activeTab === "attendance" && (
          <div className="bg-white border border-[#A9772F]/20 p-6 rounded-xl shadow-lg text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#A9772F]/10 pb-4 mb-6 gap-4">
              <h3 className="text-xl font-bold text-[#A9772F] flex items-center gap-2">
                <Calendar className="text-[#A9772F]" size={22} />
                <span>દૈનિક હાજરીપત્રક પત્રક (Attendance Tracker)</span>
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-[#2B2620]/70 font-sans">હાજરી તારીખ પસંદ કરો:</label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 min-h-[38px]"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-4 leading-normal font-sans">
              જ્યારે તમે અહીં કોઈ કર્મચારીને "હાજર" અથવા "ગેરહાજર" માર્ક કરશો, ત્યારે તેના આખા મહિનાના ચૂકવવાપાત્ર 
              ડ્યુટી દિવસો (duty days) ઓટોમેટિક કેલ્ક્યુલેટ થશે અને પગાર પત્રકમાં અપડેટ થઈ જશે.
            </p>

            <div className="space-y-3">
              {employees.map((emp) => {
                const status = getAttendanceStatus(emp.id);
                return (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3.5 bg-white border border-[#A9772F]/15 rounded-xl hover:shadow-sm transition-all bg-gradient-to-r from-transparent to-[#FDFBF7]/30"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-[#8B2E2E] block">
                        {emp.employee_login_id}
                      </span>
                      <span className="font-bold text-gray-800 text-sm">{emp.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMarkAttendance(emp.id, "present")}
                        className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5 min-h-[40px] border ${
                          status === "present"
                            ? "bg-[#2F5D42] text-white border-transparent"
                            : "bg-gray-50 text-[#2B2620]/80 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <CheckCircle size={14} />
                        <span>હાજર (Present)</span>
                      </button>
                      <button
                        onClick={() => handleMarkAttendance(emp.id, "absent")}
                        className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5 min-h-[40px] border ${
                          status === "absent"
                            ? "bg-[#8B2E2E] text-white border-transparent"
                            : "bg-gray-50 text-[#2B2620]/80 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <XCircle size={14} />
                        <span>ગેરહાજર (Absent)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: NOTIFICATION LOG */}
        {activeTab === "notifications" && (
          <div className="bg-white border border-[#A9772F]/20 p-6 rounded-xl shadow-lg text-left">
            <h3 className="text-xl font-bold text-[#A9772F] border-b border-[#A9772F]/10 pb-4 mb-4 flex items-center gap-2">
              <Clock className="text-[#A9772F]" size={22} />
              <span>નોટિફિકેશન ઇતિહાસ અને ઓડિટ લોગ (Notification Logs)</span>
            </h3>

            <p className="text-xs text-gray-500 mb-6 leading-normal font-sans">
              જ્યારે પણ તમે પગાર વિગત અપડેટ કરો છો અથવા ઉપાડ ઉમેરો છો, ત્યારે તે કર્મચારીના ફોન પર મોકલેલા લાઈવ નોટિફિકેશનની હિસ્ટ્રી અહીં જોઈ શકાય છે.
            </p>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {notificationLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-400 italic">
                  કોઈ નોટિફિકેશન રેકોર્ડ મળ્યો નથી.
                </div>
              ) : (
                notificationLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 bg-white rounded-xl border border-[#A9772F]/15 shadow-sm flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            log.type === "upad"
                              ? "bg-red-50 text-[#8B2E2E] border border-[#8B2E2E]/20"
                              : "bg-emerald-50 text-[#2F5D42] border border-[#2F5D42]/20"
                          }`}
                        >
                          {log.type === "upad" ? "ઉપાડ" : "પગાર અપડેટ"}
                        </span>
                        <span className="font-mono text-xs text-gray-400">
                          {new Date(log.created_at).toLocaleString("gu-IN")}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-[#2B2620] mt-1.5">{log.title}</h4>
                      <p className="text-xs text-gray-600 mt-0.5">{log.message}</p>
                    </div>

                    {log.amount && (
                      <span className="font-mono font-extrabold text-[#8B2E2E] text-base">
                        -₹{log.amount}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
