import React from "react";
import { Trash2, TrendingDown, TrendingUp, Calendar, BookOpen } from "lucide-react";
import { Withdrawal, MonthlyRecord } from "../types";

interface LedgerCardProps {
  withdrawals: Withdrawal[];
  record: MonthlyRecord | null;
  onDeleteWithdrawal?: (id: string) => void;
  isAdmin?: boolean;
  lang: "gu" | "hi";
}

export default function LedgerCard({
  withdrawals,
  record,
  onDeleteWithdrawal,
  isAdmin = false,
  lang,
}: LedgerCardProps) {
  const isGuj = lang === "gu";

  // Translate helper
  const t = (gu: string, hi: string) => (isGuj ? gu : hi);

  return (
    <div className="border border-[#A9772F]/30 bg-white shadow-xl rounded-xl overflow-hidden text-[#2B2620] relative">
      {/* Ledger Card Header */}
      <div className="bg-[#A9772F] text-white px-6 py-4 flex items-center justify-between border-b border-[#A9772F]/20 font-sans">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="opacity-90" />
          <span className="font-bold tracking-tight text-lg">
            {t("ખાતા વહી પત્રક (લેજર)", "खाता बही पत्रक (लेज़र)")}
          </span>
        </div>
        <div className="font-mono text-sm px-3 py-1 bg-white/20 rounded-full font-bold">
          {record ? `${record.month}/${record.year}` : "--/--"}
        </div>
      </div>

      {/* Main Ledger Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 relative min-h-[350px]">
        
        {/* Left Column: Withdrawals (ઉપાડ / उपाड़) - Maroon Accent */}
        <div className="p-6 border-b md:border-b-0 border-[#A9772F]/20 bg-[#FFF5F5]/20">
          <div className="flex items-center justify-between border-b border-[#8B2E2E]/30 pb-3 mb-4">
            <h3 className="text-[#8B2E2E] font-bold text-lg flex items-center gap-1.5">
              <TrendingDown size={18} />
              <span>{t("ઉપાડ (ડેબિટ)", "उपाड़ / अग्रिम (नाम)")}</span>
            </h3>
            <span className="font-mono text-xs text-[#8B2E2E]/70 font-bold tracking-widest uppercase">
              {t("ઉધાર પક્ષ", "डेबिट पक्ष")}
            </span>
          </div>

          {withdrawals.length === 0 ? (
            <div className="text-center py-16 text-gray-400 italic font-sans text-sm">
              {t("કોઈ ઉપાડ નોંધાયેલ નથી", "कोई उपाड़ दर्ज नहीं है")}
            </div>
          ) : (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="flex items-start justify-between p-3 rounded-lg border border-[#8B2E2E]/10 bg-white shadow-sm hover:shadow-md transition-all text-left"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-[#8B2E2E]/70" />
                      <span className="text-xs text-[#2B2620]/60 font-mono">
                        {new Date(w.date).toLocaleDateString(
                          isGuj ? "gu-IN" : "hi-IN",
                          { day: "2-digit", month: "short" }
                        )}
                      </span>
                    </div>
                    <p className="text-sm font-sans font-medium text-[#2B2620] mt-0.5 break-words">
                      {w.note || t("ઉપાડ પેટે", "उपाड़ एडवांस")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-2">
                    <span className="font-mono font-bold text-base text-[#8B2E2E]">
                      ₹{w.amount}
                    </span>
                    {isAdmin && onDeleteWithdrawal && (
                      <button
                        onClick={() => onDeleteWithdrawal(w.id)}
                        className="text-[#8B2E2E]/40 hover:text-[#8B2E2E] p-1.5 rounded-full hover:bg-[#8B2E2E]/10 transition-colors cursor-pointer"
                        title={t("કાઢી નાખો", "हटाएं")}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vertical Red Dashed Divider (Visible on desktop) */}
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[2px] bg-transparent pointer-events-none z-10 border-l border-dashed border-[#8B2E2E]/25"></div>

        {/* Right Column: Earnings & Salary (પગાર / सैलरी) - Forest Green Accent */}
        <div className="p-6 bg-white">
          <div className="flex items-center justify-between border-b border-[#2F5D42]/30 pb-3 mb-4">
            <h3 className="text-[#2F5D42] font-bold text-lg flex items-center gap-1.5">
              <TrendingUp size={18} />
              <span>{t("પગાર (ક્રેડિટ)", "सैलरी / जमा (जમા)")}</span>
            </h3>
            <span className="font-mono text-xs text-[#2F5D42]/70 font-bold tracking-widest uppercase">
              {t("જમા પક્ષ", "क्रेडिट पक्ष")}
            </span>
          </div>

          {!record ? (
            <div className="text-center py-16 text-gray-400 italic text-sm">
              {t("પત્રક લોડ થઈ રહ્યું છે...", "बही पत्रक लोड हो रहा है...")}
            </div>
          ) : (
            <div className="space-y-4 text-sm font-sans">
              <div className="grid grid-cols-2 gap-2 border-b border-[#A9772F]/10 pb-2">
                <span className="text-[#2B2620]/75">{t("હાજર દિવસો (ડ્યુટી):", "ड्यूटी दिन:")}</span>
                <span className="font-mono font-bold text-right">{record.duty_days} {t("દિવસ", "दिन")}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 border-b border-[#A9772F]/10 pb-2">
                <span className="text-[#2B2620]/75">{t("પગાર કમાણી (હાજરી):", "उपार्जित वेतन:")}</span>
                <span className="font-mono font-bold text-right text-[#2F5D42]">₹{record.total_earned}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-[#A9772F]/10 pb-2">
                <span className="text-[#2B2620]/75">{t("ઓવરટાઇમ (₹):", "ओवरटाइम (₹):")}</span>
                <span className="font-mono font-bold text-right text-[#2F5D42]">₹{record.overtime_amount}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-[#A9772F]/10 pb-2 bg-[#FFF5F5]/60 p-2 rounded-lg border border-[#8B2E2E]/10">
                <span className="text-[#8B2E2E] text-xs font-bold">{t("ગયા મહિનાની કપાત (Carry In):", "गत माह का बकाया (Carry In):")}</span>
                <span className="font-mono font-bold text-right text-[#8B2E2E]">₹{record.carry_forward_in}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-[#A9772F]/10 pb-2 bg-amber-50/40 p-2 rounded-lg border border-[#A9772F]/15">
                <span className="text-[#2B2620]/75 font-semibold">{t("કુલ ઉપાડ (ડેબિટ થયેલ):", "कुल निकासी (डेबिट):")}</span>
                <span className="font-mono font-bold text-right text-[#8B2E2E]">₹{record.total_withdrawals}</span>
              </div>

              {/* Total Summary Row */}
              <div className="p-4 rounded-xl border border-[#A9772F]/30 bg-[#F3EBD8]/30 flex items-center justify-between shadow-sm">
                <span className="font-bold text-base text-[#2B2620]/90">
                  {t("આખરી ચૂકવવાપાત્ર પગાર:", "कुल देय अंतिम सैलरी:")}
                </span>
                <span
                  className={`font-mono font-extrabold text-2xl ${
                    record.final_salary < 0 ? "text-[#8B2E2E]" : "text-[#2F5D42]"
                  }`}
                >
                  ₹{record.final_salary}
                </span>
              </div>

              {/* Carry Forward warning badge */}
              {record.final_salary < 0 && (
                <div className="bg-[#FFF5F5] border border-[#8B2E2E]/15 p-3 rounded-lg text-[#8B2E2E] flex items-start gap-2 mt-2 font-medium leading-tight shadow-sm">
                  <span className="text-base">⚠️</span>
                  <p className="text-xs">
                    {t(
                      "આખરી પગાર માઈનસ હોવાથી આ ડેફિસિટ કપાત આગળના મહિનાના પગાર પત્રકમાં ઉમેરાઈ જશે.",
                      "इस महीने का वेतन नकारात्मक है, इसलिए यह कमी अगले महीने के वेतन से अपने आप काट ली जाएगी।"
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
