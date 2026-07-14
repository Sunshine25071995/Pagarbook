import React, { useState } from "react";
import { LogIn, Key, Mail, ShieldAlert, UserCheck } from "lucide-react";
import { AuthState } from "../types";

interface LoginScreenProps {
  onLoginSuccess: (user: AuthState) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [employeeLoginId, setEmployeeLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = isAdmin
        ? { email, password }
        : { employee_login_id: employeeLoginId.toUpperCase(), password };

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onLoginSuccess({
          isAuthenticated: true,
          role: data.user.role,
          employee_id: data.user.employee_id,
          user_id: data.user.id,
          name: data.user.name,
          login_id: data.user.login_id,
        });
      } else {
        setError(data.message || "ખોટી લોગીન માહિતી / गलत लॉगिन विवरण");
      }
    } catch (err) {
      console.error("Login failed:", err);
      setError("સર્વર કનેક્શન નિષ્ફળ થયું છે. / सर्वर कनेक्शन विफल रहा।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 artistic-flair-bg">
      {/* Decorative ledger borders */}
      <div className="w-full max-w-md bg-white border border-[#A9772F]/30 p-8 rounded-xl shadow-2xl relative overflow-hidden">
        
        {/* Ledger red margin line style */}
        <div className="absolute top-0 bottom-0 left-6 w-[2px] bg-red-400 opacity-25"></div>

        <div className="relative pl-6">
          <div className="text-center mb-6">
            <div className="inline-flex w-16 h-16 rounded bg-[#A9772F] items-center justify-center text-white text-3xl font-bold border border-[#A9772F]/20 mb-3 shadow-md">
              <span>SB</span>
            </div>
            <h1 className="text-3xl font-extrabold font-guj-head text-[#A9772F] tracking-tight">
              સનશાઇન પગાર બુક 📚
            </h1>
            <p className="text-[#2B2620]/60 italic text-sm mt-1">
              Sunshine Pagar Book — પ્રવેશ દ્વાર
            </p>
            <div className="h-[2px] bg-[#A9772F]/20 w-32 mx-auto mt-3"></div>
          </div>

          {/* Toggle Role Selector */}
          <div className="grid grid-cols-2 gap-2 mb-6 border border-[#A9772F]/30 p-1 bg-[#F3EBD8]/40 rounded-full">
            <button
              onClick={() => {
                setIsAdmin(false);
                setError("");
              }}
              className={`py-2 px-3 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !isAdmin
                  ? "bg-[#A9772F] text-white shadow-md"
                  : "text-[#2B2620] hover:bg-black/5"
              }`}
            >
              <UserCheck size={14} />
              <span>કર્મચારી લોગિન / कर्मचारी</span>
            </button>
            <button
              onClick={() => {
                setIsAdmin(true);
                setError("");
              }}
              className={`py-2 px-3 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isAdmin
                  ? "bg-[#A9772F] text-white shadow-md"
                  : "text-[#2B2620] hover:bg-black/5"
              }`}
            >
              <ShieldAlert size={14} />
              <span>એડમિન લોગિન / एडमिन</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-[#8B2E2E]/20 text-[#8B2E2E] text-xs rounded-lg font-medium leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {isAdmin ? (
              // Admin Fields (ID/Email + Password)
              <div>
                <label className="block text-xs font-bold text-[#2B2620]/75 mb-1 font-sans">
                  એડમિન આઈડી / एडमिन आईडी
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9772F]/70" size={16} />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="દા.ત. 753"
                    className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 transition-all placeholder:text-gray-400 font-sans min-h-[44px]"
                  />
                </div>
              </div>
            ) : (
              // Employee Fields (Employee ID + Password)
              <div>
                <label className="block text-xs font-bold text-[#2B2620]/75 mb-1 font-sans">
                  કર્મચારી આઈડી / कर्मचारी आईडी
                </label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9772F]/70" size={16} />
                  <input
                    type="text"
                    required
                    value={employeeLoginId}
                    onChange={(e) => setEmployeeLoginId(e.target.value)}
                    placeholder="દા.ત. EMP101"
                    className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 transition-all placeholder:text-gray-400 font-sans min-h-[44px] uppercase"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 pl-1">
                  *એડમિન દ્વારા આપેલ આઈડી દાખલ કરો
                </p>
              </div>
            )}

            {/* Password input */}
            <div>
              <label className="block text-xs font-bold text-[#2B2620]/75 mb-1 font-sans">
                પાસવર્ડ / पासवर्ड
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9772F]/70" size={16} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#FDFBF7] border border-[#A9772F]/30 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#A9772F]/20 transition-all placeholder:text-gray-400 font-sans min-h-[44px]"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#A9772F] hover:bg-[#8B2E2E] text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer border border-[#A9772F]/20 min-h-[44px]"
            >
              {loading ? (
                <span>ચકાસણી ચાલુ છે...</span>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>પ્રવેશ કરો / लॉगिन करें</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
