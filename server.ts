import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL || "https://vqkvrnjdaxribilphxes.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxa3ZybmpkYXhyaWJpbHBoeGVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAxMjE2NiwiZXhwIjoyMDk5NTg4MTY2fQ.RtXHyYXhITacmnpKIHNnNSXeFsGTDTbO7siAQkFSxa8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Suggested duty days: total days in month minus Wednesdays
function getSuggestedDutyDays(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let wednesdays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() === 3) { // 3 is Wednesday
      wednesdays++;
    }
  }
  return daysInMonth - wednesdays;
}

// Helper to cascade salary recalculation
async function recalculateEmployeeRecordsInSupabase(employeeId: string) {
  try {
    // 1. Fetch employee
    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();
    if (empErr || !emp) {
      console.error("recalculate: Employee not found", employeeId, empErr);
      return;
    }

    const perDaySalary = emp.monthly_salary / 26;

    // 2. Fetch all monthly records for the employee
    const { data: records, error: recsErr } = await supabase
      .from("monthly_records")
      .select("*")
      .eq("employee_id", employeeId);
    if (recsErr || !records) {
      console.error("recalculate: Error fetching monthly records", recsErr);
      return;
    }

    // Sort chronologically (year * 12 + month)
    records.sort((a: any, b: any) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

    // 3. Fetch all withdrawals for the employee
    const { data: withdrawals } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("employee_id", employeeId);
    const withdrawalList = withdrawals || [];

    let prevCarryForwardOut = 0;

    for (const rec of records) {
      // Calculate duty days present from attendance if present
      rec.total_earned = Math.round(perDaySalary * rec.duty_days);

      // Sum of withdrawals for that month
      const monthWithdrawals = withdrawalList.filter((w: any) => {
        const wDate = new Date(w.date);
        return (
          wDate.getFullYear() === rec.year &&
          wDate.getMonth() + 1 === rec.month
        );
      });
      rec.total_withdrawals = monthWithdrawals.reduce(
        (sum: number, w: any) => sum + Number(w.amount),
        0
      );

      rec.carry_forward_in = prevCarryForwardOut;

      // final_salary = total_earned + overtime_amount - total_withdrawals - carry_forward_in
      rec.final_salary =
        rec.total_earned +
        Number(rec.overtime_amount || 0) -
        rec.total_withdrawals -
        rec.carry_forward_in;

      // If final_salary < 0: carry_forward_out = abs(final_salary), else 0
      if (rec.final_salary < 0) {
        rec.carry_forward_out = Math.abs(rec.final_salary);
      } else {
        rec.carry_forward_out = 0;
      }

      rec.updated_at = new Date().toISOString();
      prevCarryForwardOut = rec.carry_forward_out;

      // Update in Supabase
      await supabase
        .from("monthly_records")
        .update({
          total_earned: rec.total_earned,
          total_withdrawals: rec.total_withdrawals,
          carry_forward_in: rec.carry_forward_in,
          final_salary: rec.final_salary,
          carry_forward_out: rec.carry_forward_out,
          updated_at: rec.updated_at,
        })
        .eq("id", rec.id);
    }
  } catch (err) {
    console.error("Error in recalculateEmployeeRecordsInSupabase:", err);
  }
}

// Get or create monthly record
async function getOrCreateRecordInSupabase(employeeId: string, year: number, month: number) {
  try {
    const { data: existingRec } = await supabase
      .from("monthly_records")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (existingRec) {
      return existingRec;
    }

    // Generate suggested duty days
    const dutyDays = getSuggestedDutyDays(year, month);

    // Find carry_forward_in by looking at previous month
    let carryForwardIn = 0;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const { data: prevRec } = await supabase
      .from("monthly_records")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("year", prevYear)
      .eq("month", prevMonth)
      .maybeSingle();

    if (prevRec && prevRec.final_salary < 0) {
      carryForwardIn = Math.abs(prevRec.final_salary);
    }

    // Fetch employee
    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();

    const perDaySalary = emp ? emp.monthly_salary / 26 : 0;
    const totalEarned = Math.round(perDaySalary * dutyDays);

    const newRec = {
      id: `rec-${employeeId}-${year}-${month}`,
      employee_id: employeeId,
      year,
      month,
      duty_days: dutyDays,
      overtime_amount: 0,
      carry_forward_in: carryForwardIn,
      total_earned: totalEarned,
      total_withdrawals: 0,
      final_salary: totalEarned - carryForwardIn,
      carry_forward_out: (totalEarned - carryForwardIn) < 0 ? Math.abs(totalEarned - carryForwardIn) : 0,
      updated_at: new Date().toISOString(),
    };

    await supabase.from("monthly_records").upsert(newRec);
    await recalculateEmployeeRecordsInSupabase(employeeId);

    const { data: finalRec } = await supabase
      .from("monthly_records")
      .select("*")
      .eq("id", newRec.id)
      .single();

    return finalRec || newRec;
  } catch (err) {
    console.error("Error in getOrCreateRecordInSupabase:", err);
    return null;
  }
}

// Keep track of real-time SSE connections
interface SSEConnection {
  employeeId?: string;
  response: any;
}
let sseConnections: SSEConnection[] = [];

// Helper to push real-time notification
function pushRealtimeUpdate(employeeId: string, notification: any) {
  sseConnections.forEach((conn) => {
    if (!conn.employeeId || conn.employeeId === employeeId) {
      conn.response.write(`data: ${JSON.stringify(notification)}\n\n`);
    }
  });
}

// REST API Routes

// 1. Authentication
app.post("/api/auth/login", async (req, res) => {
  const { email, password, employee_login_id } = req.body;

  try {
    let user;
    if (employee_login_id) {
      const targetEmail = `${employee_login_id.toLowerCase()}@sunshinepagarbook.internal`;
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("email", targetEmail)
        .eq("password", password)
        .maybeSingle();
      user = data;
    } else if (email) {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("password", password)
        .maybeSingle();
      user = data;
    }

    if (user) {
      let empName = "Admin";
      if (user.employee_id) {
        const { data: emp } = await supabase
          .from("employees")
          .select("name")
          .eq("id", user.employee_id)
          .single();
        if (emp) empName = emp.name;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          employee_id: user.employee_id,
          name: empName,
          login_id: user.employee_login_id,
        },
      });
    } else {
      res.status(401).json({ success: false, message: "નજીવી વિગતો ખોટી છે / लॉगिन विवरण गलत हैं" });
    }
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "સર્વર કનેક્શન ભૂલ" });
  }
});

// 2. Employees CRUD (Admin only)
app.get("/api/employees", async (req, res) => {
  try {
    const { data: emps, error } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json(emps || []);
  } catch (err: any) {
    console.error("Get employees error:", err);
    res.status(500).json({ success: false, message: "કર્મચારીઓની યાદી લાવવામાં નિષ્ફળતા" });
  }
});

app.post("/api/employees", async (req, res) => {
  const { name, mobile, employee_login_id, password, monthly_salary } = req.body;

  try {
    // Validate unique employee ID
    const { data: existing } = await supabase
      .from("employees")
      .select("id")
      .eq("employee_login_id", employee_login_id.toUpperCase())
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ success: false, message: "આ કર્મચારી આઈડી પહેલેથી જ અસ્તિત્વમાં છે." });
    }

    const newEmpId = `emp-${Date.now()}`;
    const newEmp = {
      id: newEmpId,
      name,
      mobile,
      employee_login_id: employee_login_id.toUpperCase(),
      monthly_salary: Number(monthly_salary),
      created_at: new Date().toISOString(),
    };

    const { error: empErr } = await supabase.from("employees").insert(newEmp);
    if (empErr) throw empErr;

    // Add auth user credentials
    const targetEmail = `${employee_login_id.toLowerCase()}@sunshinepagarbook.internal`;
    const { error: userErr } = await supabase.from("users").insert({
      id: `${newEmpId}-uid`,
      email: targetEmail,
      employee_login_id: employee_login_id.toUpperCase(),
      password: password || "password123",
      role: "employee",
      employee_id: newEmpId,
    });
    if (userErr) throw userErr;

    res.json({ success: true, employee: newEmp });
  } catch (err: any) {
    console.error("Create employee error:", err);
    res.status(500).json({ success: false, message: "કર્મચારી ઉમેરવામાં ભૂલ થઈ." });
  }
});

app.put("/api/employees/:id", async (req, res) => {
  const { id } = req.params;
  const { name, mobile, monthly_salary, password } = req.body;

  try {
    const { error: empErr } = await supabase
      .from("employees")
      .update({
        name,
        mobile,
        monthly_salary: Number(monthly_salary),
      })
      .eq("id", id);
    if (empErr) throw empErr;

    // Update password if provided
    if (password) {
      await supabase
        .from("users")
        .update({ password })
        .eq("employee_id", id);
    }

    await recalculateEmployeeRecordsInSupabase(id);

    const { data: updatedEmp } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .single();

    res.json({ success: true, employee: updatedEmp });
  } catch (err: any) {
    console.error("Update employee error:", err);
    res.status(500).json({ success: false, message: "કર્મચારી અપડેટ કરવામાં ભૂલ થઈ." });
  }
});

app.delete("/api/employees/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Relying on cascade deletes in foreign keys
    await supabase.from("employees").delete().eq("id", id);
    await supabase.from("users").delete().eq("employee_id", id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete employee error:", err);
    res.status(500).json({ success: false, message: "કર્મચારી કાઢી નાખવામાં ભૂલ થઈ." });
  }
});

// 3. Monthly Records (Admin & Employee)
app.get("/api/monthly_records/:employeeId/:year/:month", async (req, res) => {
  const { employeeId, year, month } = req.params;
  try {
    const record = await getOrCreateRecordInSupabase(employeeId, parseInt(year), parseInt(month));
    res.json(record);
  } catch (err: any) {
    console.error("Get monthly record error:", err);
    res.status(500).json({ success: false, message: "પગાર પત્રક મેળવવામાં ભૂલ થઈ." });
  }
});

app.get("/api/monthly_records/all/:employeeId", async (req, res) => {
  const { employeeId } = req.params;
  try {
    const now = new Date();
    await getOrCreateRecordInSupabase(employeeId, now.getFullYear(), now.getMonth() + 1);

    const { data: records } = await supabase
      .from("monthly_records")
      .select("*")
      .eq("employee_id", employeeId);
    res.json(records || []);
  } catch (err: any) {
    console.error("Get all monthly records error:", err);
    res.status(500).json({ success: false, message: "ઇતિહાસ મેળવવામાં નિષ્ફળતા." });
  }
});

app.post("/api/monthly_records/update", async (req, res) => {
  const { employee_id, year, month, duty_days, overtime_amount } = req.body;

  try {
    let rec = await getOrCreateRecordInSupabase(employee_id, Number(year), Number(month));
    if (!rec) {
      return res.status(404).json({ success: false, message: "પત્રક શરૂ કરવામાં ભૂલ." });
    }

    const updates: any = {};
    if (duty_days !== undefined) updates.duty_days = Number(duty_days);
    if (overtime_amount !== undefined) updates.overtime_amount = Number(overtime_amount);
    updates.updated_at = new Date().toISOString();

    const { error: updErr } = await supabase
      .from("monthly_records")
      .update(updates)
      .eq("id", rec.id);
    if (updErr) throw updErr;

    await recalculateEmployeeRecordsInSupabase(employee_id);

    // Fetch newly recalculated
    const { data: refreshedRec } = await supabase
      .from("monthly_records")
      .select("*")
      .eq("id", rec.id)
      .single();

    // Insert notification
    const formattedMonthStr = `${month}/${year}`;
    const notification = {
      id: `notif-${Date.now()}`,
      employee_id,
      type: "pagar",
      title: "सैलरी अपडेट / પગાર અપડેટ",
      message: `आपके महीने ${formattedMonthStr} की सैलरी डिटेल्स अपडेट की गई है।`,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    await supabase.from("notifications").insert(notification);
    pushRealtimeUpdate(employee_id, notification);

    res.json({ success: true, record: refreshedRec });
  } catch (err: any) {
    console.error("Update monthly record error:", err);
    res.status(500).json({ success: false, message: "પગાર અપડેટ કરવામાં ભૂલ." });
  }
});

// 4. Withdrawals CRUD
app.get("/api/withdrawals/:employeeId", async (req, res) => {
  const { employeeId } = req.params;
  try {
    const { data: list } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });
    res.json(list || []);
  } catch (err: any) {
    console.error("Get withdrawals error:", err);
    res.status(500).json({ success: false, message: "ઉપાડ વિગતો લાવવામાં નિષ્ફળતા." });
  }
});

app.post("/api/withdrawals", async (req, res) => {
  const { employee_id, date, amount, note, created_by } = req.body;

  try {
    const wDate = new Date(date);
    const year = wDate.getFullYear();
    const month = wDate.getMonth() + 1;

    const rec = await getOrCreateRecordInSupabase(employee_id, year, month);
    if (!rec) {
      return res.status(500).json({ success: false, message: "પત્રક મેળવી શકાયું નથી." });
    }

    const newWithdrawal = {
      id: `with-${Date.now()}`,
      monthly_record_id: rec.id,
      employee_id,
      date,
      amount: Number(amount),
      note: note || "",
      created_by: created_by || "admin",
      created_at: new Date().toISOString(),
    };

    const { error: withErr } = await supabase.from("withdrawals").insert(newWithdrawal);
    if (withErr) throw withErr;

    await recalculateEmployeeRecordsInSupabase(employee_id);

    // Insert notification
    const notification = {
      id: `notif-${Date.now()}`,
      employee_id,
      type: "upad",
      title: "નવા ઉપાડ (Withdrawal) / नया उपाड़",
      message: `आपको ₹${amount} का उपाड़ मिला है। नोट: ${note || "કોઈ નોંધ નથી"}`,
      amount: Number(amount),
      is_read: false,
      created_at: new Date().toISOString(),
    };

    await supabase.from("notifications").insert(notification);
    pushRealtimeUpdate(employee_id, notification);

    res.json({ success: true, withdrawal: newWithdrawal });
  } catch (err: any) {
    console.error("Create withdrawal error:", err);
    res.status(500).json({ success: false, message: "ઉપાડ નોંધવામાં ભૂલ." });
  }
});

app.delete("/api/withdrawals/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { data: withdrawal } = await supabase
      .from("withdrawals")
      .select("employee_id")
      .eq("id", id)
      .maybeSingle();

    if (withdrawal) {
      const employee_id = withdrawal.employee_id;
      await supabase.from("withdrawals").delete().eq("id", id);
      await recalculateEmployeeRecordsInSupabase(employee_id);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: "ઉપાડ મળ્યો નથી." });
    }
  } catch (err: any) {
    console.error("Delete withdrawal error:", err);
    res.status(500).json({ success: false, message: "ઉપાડ કાઢી નાખવામાં ભૂલ." });
  }
});

// 5. Attendance CRUD
app.get("/api/attendance/:employeeId", async (req, res) => {
  const { employeeId } = req.params;
  try {
    const { data: list } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", employeeId);
    res.json(list || []);
  } catch (err: any) {
    console.error("Get attendance error:", err);
    res.status(500).json([]);
  }
});

app.post("/api/attendance", async (req, res) => {
  const { employee_id, date, status } = req.body;

  try {
    const attId = `att-${employee_id}-${date}`;
    await supabase.from("attendance").upsert({
      id: attId,
      employee_id,
      date,
      status,
    });

    const [yearStr, monthStr] = date.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const rec = await getOrCreateRecordInSupabase(employee_id, year, month);

    // Count present days in this month
    const { data: monthAttendance } = await supabase
      .from("attendance")
      .select("date")
      .eq("employee_id", employee_id)
      .eq("status", "present");

    const presentCount = (monthAttendance || []).filter((a: any) => {
      const [y, m] = a.date.split("-");
      return parseInt(y) === year && parseInt(m) === month;
    }).length;

    if (presentCount > 0 && rec) {
      await supabase
        .from("monthly_records")
        .update({ duty_days: presentCount })
        .eq("id", rec.id);
    }

    await recalculateEmployeeRecordsInSupabase(employee_id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Submit attendance error:", err);
    res.status(500).json({ success: false, message: "હાજરી સેવ કરવામાં ભૂલ થઈ." });
  }
});

// 6. Notifications CRUD
app.get("/api/notifications/:employeeId", async (req, res) => {
  const { employeeId } = req.params;
  try {
    const { data: list } = await supabase
      .from("notifications")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });
    res.json(list || []);
  } catch (err: any) {
    console.error("Get notifications error:", err);
    res.status(500).json([]);
  }
});

app.post("/api/notifications/mark-read", async (req, res) => {
  const { employee_id } = req.body;
  try {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("employee_id", employee_id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Mark read error:", err);
    res.status(500).json({ success: false });
  }
});

// 7. Live Sync (Server Sent Events)
app.get("/api/live-sync", (req, res) => {
  const { employee_id } = req.query;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const conn: SSEConnection = {
    employeeId: employee_id ? String(employee_id) : undefined,
    response: res,
  };

  sseConnections.push(conn);

  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  req.on("close", () => {
    sseConnections = sseConnections.filter((c) => c !== conn);
  });
});

// 8. Gemini Command Bar (Natural-Language Interface)
app.post("/api/gemini/command", async (req, res) => {
  const { text } = req.body;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(500).json({
      success: false,
      message: "Gemini API key is not configured in settings secrets.",
    });
  }

  try {
    const { data: employees } = await supabase.from("employees").select("id, name, employee_login_id");
    const employeeContext = (employees || []).map((e) => ({
      id: e.id,
      name: e.name,
      employee_login_id: e.employee_login_id,
    }));

    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemPrompt = `
You are the Natural Language Command Interpreter for Sunshine Pagar Book (સનશાઇન પગાર બુક 📚).
You translate user commands in mixed Gujarati, Hindi, and English (Hinglish/Gujlish) into JSON schema.
The current date/time is ${new Date().toISOString()}. The year is 2026. The month is 7 (July).

Available employees:
${JSON.stringify(employeeContext, null, 2)}

Classify the command into either a "query" (reading records) or a "write" (adding withdrawal, adding overtime, updating duty days) action.
You MUST return STRICT JSON output only. No markdown formatting blocks around JSON, no explanation. Just raw JSON.

Return format:
{
  "action": "query" | "write" | "clarify",
  "employee_login_id": "EMP101",
  "employee_name": "Kaushik Patel",
  "operation": "get_total_withdrawal" | "add_withdrawal" | "add_overtime" | "get_final_salary" | "update_duty_days",
  "amount": 5000,
  "note": "Advance upad",
  "month": 7,
  "year": 2026,
  "message": "Clarification message in Gujarati if action is clarify"
}

Rules:
1. Match the employee name. If you are not sure or if name is ambiguous or doesn't match any employee, set action to "clarify" and ask to clarify in sweet Gujarati.
2. If it is "query", we will execute the query and send back the summary to you to speak to the user.
3. If it is "write", we will show a confirmation prompt to the user with the amount, employee name, and operation before writing.
4. Default to current month (7) and year (2026) unless another month/year is explicitly specified.

Example commands:
"Kaushik ko 5000 upad diya" -> write, EMP101, add_withdrawal, amount: 5000, note: "ઉપાડ"
"Kaushik ko total upad kitna mila?" -> query, EMP101, get_total_withdrawal
"Sanjay ko 1000 overtime" -> write, EMP103, add_overtime, amount: 1000
"Vijay no pagar ketlo chhe?" -> query, EMP102, get_final_salary
"Kaushik na duty days 24 karo" -> write, EMP101, update_duty_days, amount: 24 (store in amount or duty_days)
"Pagar book kaisa hai" -> clarify, message: "હું કર્મચારીનો પગાર, ઉપાડ અથવા ઓવરટાઇમ ટ્રેક કરી શકું છું. જેમ કે: 'કૌશિકને ૫૦૦૦ ઉપાડ આપ્યો'."
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: text,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
    });

    const parsedResponse = JSON.parse(response.text?.trim() || "{}");

    if (parsedResponse.action === "query") {
      const emp = (employees || []).find(
        (e) => e.employee_login_id === parsedResponse.employee_login_id
      );
      if (!emp) {
        return res.json({
          action: "clarify",
          message: `કર્મચારી ${parsedResponse.employee_name || ""} મળ્યો નથી.`,
        });
      }

      const rec = await getOrCreateRecordInSupabase(
        emp.id,
        parsedResponse.year || 2026,
        parsedResponse.month || 7
      );

      if (!rec) {
        return res.json({
          action: "clarify",
          message: `કર્મચારી વિગતો લાવવામાં ભૂલ થઈ.`,
        });
      }

      let queryResult = "";
      if (parsedResponse.operation === "get_total_withdrawal") {
        queryResult = `${emp.name} નો આ મહિનાનો કુલ ઉપાડ ₹${rec.total_withdrawals} છે.`;
      } else if (parsedResponse.operation === "get_final_salary") {
        queryResult = `${emp.name} નો આ મહિનાનો ચોખ્ખો પગાર ₹${rec.final_salary} છે. (હાજર દિવસો: ${rec.duty_days}, ઓવરટાઇમ: ₹${rec.overtime_amount})`;
      } else {
        queryResult = `${emp.name} નો આ મહિનાનો પગાર વિગતવાર: હાજર દિવસો: ${rec.duty_days}, ઓવરટાઇમ: ₹${rec.overtime_amount}, ઉપાડ: ₹${rec.total_withdrawals}, આખરી પગાર: ₹${rec.final_salary}.`;
      }

      const finalExplanation = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `આ વિગતને સુંદર અને નમ્ર ગુજરાતી વાક્યમાં રૂપાંતરિત કરો: "${queryResult}". તેને ખૂબ ટૂંકી અને સચોટ રાખો.`,
      });

      return res.json({
        action: "reply",
        message: finalExplanation.text?.trim() || queryResult,
      });
    }

    res.json(parsedResponse);
  } catch (error: any) {
    console.error("Gemini Command Bar Error:", error);
    res.status(500).json({
      success: false,
      message: "માહિતી સમજવામાં ભૂલ થઈ. કૃપા કરીને ફરી પ્રયાસ કરો.",
    });
  }
});

app.post("/api/gemini/confirm", async (req, res) => {
  const { employee_login_id, operation, amount, note, month, year } = req.body;

  try {
    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_login_id", employee_login_id)
      .single();

    if (!emp) {
      return res.status(404).json({ success: false, message: "કર્મચારી મળ્યો નથી." });
    }

    const activeYear = year || 2026;
    const activeMonth = month || 7;
    const rec = await getOrCreateRecordInSupabase(emp.id, activeYear, activeMonth);

    if (!rec) {
      return res.status(500).json({ success: false, message: "રેકોર્ડ મેળવવામાં નિષ્ફળતા." });
    }

    if (operation === "add_withdrawal") {
      const newWithdrawal = {
        id: `with-${Date.now()}`,
        monthly_record_id: rec.id,
        employee_id: emp.id,
        date: new Date(activeYear, activeMonth - 1, 15).toISOString().split("T")[0],
        amount: Number(amount),
        note: note || "કમાન્ડ બાર દ્વારા",
        created_by: "admin",
        created_at: new Date().toISOString(),
      };

      await supabase.from("withdrawals").insert(newWithdrawal);
      await recalculateEmployeeRecordsInSupabase(emp.id);

      const notification = {
        id: `notif-${Date.now()}`,
        employee_id: emp.id,
        type: "upad",
        title: "नया उपाड़ (Withdrawal)",
        message: `आपको ₹${amount} का उपाड़ मिला है। नोट: ${note || "કમાન્ડ બાર દ્વારા"}`,
        amount: Number(amount),
        is_read: false,
        created_at: new Date().toISOString(),
      };
      await supabase.from("notifications").insert(notification);
      pushRealtimeUpdate(emp.id, notification);
    } else if (operation === "add_overtime") {
      await supabase
        .from("monthly_records")
        .update({ overtime_amount: Number(amount) })
        .eq("id", rec.id);

      await recalculateEmployeeRecordsInSupabase(emp.id);

      const notification = {
        id: `notif-${Date.now()}`,
        employee_id: emp.id,
        type: "pagar",
        title: "ओवरटाइम अपडेट",
        message: `आपके इस महीने का ओवरटाइम ₹${amount} दर्ज किया गया है।`,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      await supabase.from("notifications").insert(notification);
      pushRealtimeUpdate(emp.id, notification);
    } else if (operation === "update_duty_days") {
      await supabase
        .from("monthly_records")
        .update({ duty_days: Number(amount) })
        .eq("id", rec.id);

      await recalculateEmployeeRecordsInSupabase(emp.id);

      const notification = {
        id: `notif-${Date.now()}`,
        employee_id: emp.id,
        type: "pagar",
        title: "ड्यूटी दिन अपडेट",
        message: `आपके इस महीने का ड्यूटी दिन ${amount} दिन दर्ज किया गया है।`,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      await supabase.from("notifications").insert(notification);
      pushRealtimeUpdate(emp.id, notification);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Gemini confirm write error:", err);
    res.status(500).json({ success: false, message: "ક્રિયા સેવ કરવામાં નિષ્ફળતા." });
  }
});

// Auto Seed function
async function seedSupabaseIfNeeded() {
  try {
    // Check users
    const { count: userCount, error: userCountErr } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (!userCountErr && userCount === 0) {
      console.log("Seeding admin user to Supabase...");
      await supabase.from("users").insert({
        id: "admin-uid",
        email: "sunshinepolyfilm@gmail.com",
        password: "admin123",
        role: "admin",
      });

      console.log("Seeding default employees...");
      const defaultEmployees = [
        {
          id: "emp-101",
          name: "Kaushik Patel",
          mobile: "9876543210",
          employee_login_id: "EMP101",
          monthly_salary: 15600,
          created_at: new Date().toISOString(),
        },
        {
          id: "emp-102",
          name: "Vijay Parmar",
          mobile: "9898989898",
          employee_login_id: "EMP102",
          monthly_salary: 18200,
          created_at: new Date().toISOString(),
        },
        {
          id: "emp-103",
          name: "Sanjay Shah",
          mobile: "9797979797",
          employee_login_id: "EMP103",
          monthly_salary: 20800,
          created_at: new Date().toISOString(),
        },
      ];
      await supabase.from("employees").insert(defaultEmployees);

      console.log("Seeding default employee user accounts...");
      const defaultUsers = [
        {
          id: "emp-101-uid",
          email: "emp101@sunshinepagarbook.internal",
          employee_login_id: "EMP101",
          password: "password123",
          role: "employee",
          employee_id: "emp-101",
        },
        {
          id: "emp-102-uid",
          email: "emp102@sunshinepagarbook.internal",
          employee_login_id: "EMP102",
          password: "password123",
          role: "employee",
          employee_id: "emp-102",
        },
        {
          id: "emp-103-uid",
          email: "emp103@sunshinepagarbook.internal",
          employee_login_id: "EMP103",
          password: "password123",
          role: "employee",
          employee_id: "emp-103",
        },
      ];
      await supabase.from("users").insert(defaultUsers);
    }
  } catch (err) {
    console.error("Automatic seeding failed:", err);
  }
}

// Server configuration & Dev/Production middleware
async function startServer() {
  await seedSupabaseIfNeeded();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
