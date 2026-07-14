import React, { useState } from "react";
import { LogIn, UserCheck, ShieldAlert } from "lucide-react";
import { AuthState } from "../types";
import { loginWithGoogle } from "../firebase";

interface LoginScreenProps {
  onLoginSuccess: (user: AuthState) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [employeeLoginId, setEmployeeLoginId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!isAdmin && !employeeLoginId.trim()) {
        setError("કૃપા કરીને કર્મચારી આઈડી દાખલ કરો / कृपया कर्मचारी आईडी दर्ज करें");
        setLoading(false);
        return;
      }

      // 1. Trigger Google Sign-In Popup
      const user = await loginWithGoogle();
      if (!user || !user.email) {
        throw new Error("Google login did not return user email.");
      }

      // 2. Post credentials to our server API
      const payload = {
        email: user.email,
        name: user.displayName || user.email.split("@")[0],
        employee_login_id: isAdmin ? undefined : employeeLoginId.toUpperCase().trim(),
      };

      const response = await fetch("/api/auth/google-login", {
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
    } catch (err: any) {
      console.error("Google Login failed:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("ગૂગલ લોગિન વિન્ડો બંધ થઈ ગઈ છે. / गूगल लॉगिन विंडो बंद हो गई है।");
      } else {
        setError("સર્વર કનેક્શન નિષ્ફળ થયું છે અથવા લિંકિંગ ભૂલ છે. / सर्वर कनेक्शन विफल रहा या लिंकिंग त्रुटि।");
      }
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
              type="button"
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
              type="button"
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

          <form onSubmit={handleGoogleLogin} className="space-y-4">
            {isAdmin ? (
              // Admin Instructions
              <div className="text-center py-4 bg-amber-50/50 border border-[#A9772F]/20 rounded-lg px-3">
                <p className="text-xs text-gray-600 leading-relaxed font-bold">
                  ગૂગલ એકાઉન્ટ દ્વારા લોગિન કરો <br />
                  <span className="text-[#8B2E2E] font-mono text-xs">sunshinepolyfilm@gmail.com</span>
                </p>
                <p className="text-[10px] text-gray-500 mt-2">
                  *એડમિન ઈમેલ વગર લોગિન થશે નહીં
                </p>
              </div>
            ) : (
              // Employee Fields (Employee ID only, password is deleted!)
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
                <p className="text-[10px] text-gray-500 mt-2 pl-1 leading-normal">
                  *પ્રથમ વખત લોગિન કરતી વખતે તમારો કર્મચારી આઈડી દાખલ કરો જેથી તમારું ગૂગલ એકાઉન્ટ લિંક થઈ શકે.
                </p>
              </div>
            )}

            {/* Google Login Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4285F4] hover:bg-[#357ae8] text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer border border-[#4285F4]/20 min-h-[44px]"
            >
              {loading ? (
                <span>ચકાસણી ચાલુ છે...</span>
              ) : (
                <>
                  <svg className="w-5 h-5 fill-current mr-1" viewBox="0 0 24 24">
                    <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.986 0-.743-.08-1.3-.178-1.859H12.24z" />
                  </svg>
                  <span>ગૂગલ લોગિન / Google Login</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
