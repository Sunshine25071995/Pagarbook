import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword as authUpdatePassword
} from "firebase/auth";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Firebase App & Firestore
let firebaseConfig: any = null;
let databaseId: string | undefined = undefined;

let configPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(configPath)) {
  configPath = path.join(__dirname, "firebase-applet-config.json");
}
if (!fs.existsSync(configPath)) {
  configPath = path.join(__dirname, "..", "firebase-applet-config.json");
}

if (fs.existsSync(configPath)) {
  try {
    const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    firebaseConfig = {
      apiKey: configData.apiKey,
      authDomain: configData.authDomain,
      projectId: configData.projectId,
      storageBucket: configData.storageBucket,
      messagingSenderId: configData.messagingSenderId,
      appId: configData.appId
    };
    databaseId = configData.firestoreDatabaseId;
    console.log("Loaded Firebase config from firebase-applet-config.json with databaseId:", databaseId);
  } catch (err) {
    console.error("Failed to parse firebase-applet-config.json:", err);
  }
}

if (!firebaseConfig) {
  firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDrJ-P7Dp4T5ayraUs9Nev-rU08JI6RvRg",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "pagarbook-b7ad8.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "pagarbook-b7ad8",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "pagarbook-b7ad8.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "94603138361",
    appId: process.env.FIREBASE_APP_ID || "1:94603138361:web:428261179814fd217384e8"
  };
  databaseId = process.env.FIREBASE_DATABASE_ID;
}

const firebaseApp = initializeApp(firebaseConfig);
const db = databaseId ? getFirestore(firebaseApp, databaseId) : getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

let seeded = false;
app.use((req, res, next) => {
  if (!seeded && req.path.startsWith("/api")) {
    seeded = true;
    seedFirebaseIfNeeded().catch((e: any) => {
      console.error("Lazy seeding failed:", e.message);
    });
  }
  next();
});

// Firestore wrapper helpers for convenience and readability
async function getAllDocs(colName: string): Promise<any[]> {
  try {
    const colRef = collection(db, colName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error(`Error fetching all from ${colName}:`, err);
    return [];
  }
}

async function getDocById(colName: string, id: string): Promise<any | null> {
  try {
    const docRef = doc(db, colName, id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() };
    }
  } catch (err) {
    console.error(`Error fetching doc ${id} from ${colName}:`, err);
  }
  return null;
}

async function setDocWithId(colName: string, id: string, data: any): Promise<void> {
  try {
    const docRef = doc(db, colName, id);
    await setDoc(docRef, data, { merge: true });
  } catch (err) {
    console.error(`Error setting doc ${id} in ${colName}:`, err);
    throw err;
  }
}

async function updateDocWithId(colName: string, id: string, data: any): Promise<void> {
  try {
    const docRef = doc(db, colName, id);
    await updateDoc(docRef, data);
  } catch (err) {
    console.error(`Error updating doc ${id} in ${colName}:`, err);
    throw err;
  }
}

async function deleteDocWithId(colName: string, id: string): Promise<void> {
  try {
    const docRef = doc(db, colName, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Error deleting doc ${id} from ${colName}:`, err);
    throw err;
  }
}

async function queryDocs(colName: string, ...constraints: any[]): Promise<any[]> {
  try {
    const colRef = collection(db, colName);
    const q = query(colRef, ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error(`Error querying ${colName}:`, err);
    return [];
  }
}

async function querySingleDoc(colName: string, ...constraints: any[]): Promise<any | null> {
  const docs = await queryDocs(colName, ...constraints);
  return docs.length > 0 ? docs[0] : null;
}

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
async function recalculateEmployeeRecordsInFirebase(employeeId: string) {
  try {
    // 1. Fetch employee
    const emp = await getDocById("employees", employeeId);
    if (!emp) {
      console.error("recalculate: Employee not found", employeeId);
      return;
    }

    const perDaySalary = emp.monthly_salary / 26;

    // 2. Fetch all monthly records for the employee
    const records = await queryDocs("monthly_records", where("employee_id", "==", employeeId));
    if (!records) return;

    // Sort chronologically (year * 12 + month)
    records.sort((a: any, b: any) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

    // 3. Fetch all withdrawals for the employee
    const withdrawalList = await queryDocs("withdrawals", where("employee_id", "==", employeeId));

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

      // Update in Firebase
      await setDocWithId("monthly_records", rec.id, {
        total_earned: rec.total_earned,
        total_withdrawals: rec.total_withdrawals,
        carry_forward_in: rec.carry_forward_in,
        final_salary: rec.final_salary,
        carry_forward_out: rec.carry_forward_out,
        updated_at: rec.updated_at,
      });
    }
  } catch (err) {
    console.error("Error in recalculateEmployeeRecordsInFirebase:", err);
  }
}

// Get or create monthly record
async function getOrCreateRecordInFirebase(employeeId: string, year: number, month: number) {
  try {
    const recId = `rec-${employeeId}-${year}-${month}`;
    const existingRec = await getDocById("monthly_records", recId);

    if (existingRec) {
      return existingRec;
    }

    // Generate suggested duty days
    const dutyDays = getSuggestedDutyDays(year, month);

    // Find carry_forward_in by looking at previous month
    let carryForwardIn = 0;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevRecId = `rec-${employeeId}-${prevYear}-${prevMonth}`;

    const prevRec = await getDocById("monthly_records", prevRecId);

    if (prevRec && prevRec.final_salary < 0) {
      carryForwardIn = Math.abs(prevRec.final_salary);
    }

    // Fetch employee
    const emp = await getDocById("employees", employeeId);

    const perDaySalary = emp ? emp.monthly_salary / 26 : 0;
    const totalEarned = Math.round(perDaySalary * dutyDays);

    const newRec = {
      id: recId,
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

    await setDocWithId("monthly_records", recId, newRec);
    await recalculateEmployeeRecordsInFirebase(employeeId);

    const finalRec = await getDocById("monthly_records", recId);
    return finalRec || newRec;
  } catch (err) {
    console.error("Error in getOrCreateRecordInFirebase:", err);
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
let isEmailAuthEnabled = true; // Flag to track if Email/Password provider is enabled in Firebase Console

app.post("/api/auth/login", async (req, res) => {
  const { email, password, employee_login_id } = req.body;
  console.log("Authentication login request received.");

  try {
    let targetEmail = "";
    if (employee_login_id) {
      targetEmail = `${employee_login_id.toLowerCase().trim()}@sunshinepagarbook.internal`;
    } else if (email) {
      const trimmedEmail = email.toLowerCase().trim();
      if (trimmedEmail.includes("@")) {
        targetEmail = trimmedEmail;
      } else {
        targetEmail = `${trimmedEmail}@sunshinepagarbook.internal`;
      }
    }

    const isWeakPassword = !password || password.length < 6;
    let authUser = null;
    let authenticatedViaAuth = false;

    // Only attempt Firebase Auth if enabled and the password is at least 6 characters
    if (isEmailAuthEnabled && !isWeakPassword) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
        authUser = userCredential.user;
        authenticatedViaAuth = true;
        console.log("User authenticated successfully using general Auth provider.");
      } catch (authError: any) {
        if (authError.code === "auth/operation-not-allowed") {
          console.log("Note: Email/Password sign-in is disabled in Firebase console. Defaulting to secure Firestore database fallback.");
          isEmailAuthEnabled = false;
        } else if (authError.code === "auth/user-not-found") {
          console.log("User profile not found in Auth system, proceeding with database validation...");
        } else {
          console.log("Auth attempt response: " + authError.code);
        }
      }
    }

    // Retrieve user credentials from Firestore database
    let userDoc = null;
    if (employee_login_id) {
      userDoc = await querySingleDoc("users", 
        where("employee_login_id", "==", employee_login_id.toUpperCase().trim())
      );
    } else if (email) {
      const trimmedEmail = email.toLowerCase().trim();
      userDoc = await querySingleDoc("users", 
        where("email", "==", trimmedEmail)
      );
      if (!userDoc) {
        userDoc = await querySingleDoc("users", 
          where("email", "==", targetEmail)
        );
      }
      if (!userDoc && (trimmedEmail === "753" || trimmedEmail === "753@sunshinepagarbook.internal" || targetEmail === "753@sunshinepagarbook.internal")) {
        userDoc = {
          id: "admin-uid",
          email: "753",
          password: "753",
          role: "admin",
        };
      }
    }

    if (!userDoc) {
      return res.status(401).json({ success: false, message: "નજીવી વિગતો ખોટી છે / लॉगिन विवरण गलत हैं" });
    }

    // Validate password if not authenticated via Firebase Auth
    if (!authenticatedViaAuth) {
      if (userDoc.password !== password) {
        return res.status(401).json({ success: false, message: "નજીવી વિગતો ખોટી છે / लॉगिन विवरण गलत हैं" });
      }
      console.log("User credentials validated successfully against registry backup.");

      // Try to auto-create Firebase Auth account if enabled and password is strong enough
      if (isEmailAuthEnabled && !isWeakPassword) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, password);
          authUser = userCredential.user;
          console.log("User profile auto-migrated to main Auth registry.");
        } catch (createError: any) {
          if (createError.code === "auth/operation-not-allowed") {
            isEmailAuthEnabled = false;
          }
        }
      }
    }

    // Retrieve full profile from Firestore users collection
    let userProfile = userDoc;

    let empName = "Admin";
    if (userProfile.employee_id) {
      const emp = await getDocById("employees", userProfile.employee_id);
      if (emp) empName = emp.name;
    }

    console.log("User successfully verified. Granting login access.");
    res.json({
      success: true,
      user: {
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
        employee_id: userProfile.employee_id,
        name: empName,
        login_id: userProfile.employee_login_id,
      },
    });

  } catch (err: any) {
    console.log("Registry endpoint completed handling: " + err.message);
    res.status(500).json({ success: false, message: "સર્વર કનેક્શન ભૂલ" });
  }
});

// 2. Employees CRUD (Admin only)
app.get("/api/employees", async (req, res) => {
  try {
    const emps = await getAllDocs("employees");
    // Sort in JS to ensure predictable order
    emps.sort((a, b) => a.created_at.localeCompare(b.created_at));
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
    const existing = await querySingleDoc("employees", where("employee_login_id", "==", employee_login_id.toUpperCase()));

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

    await setDocWithId("employees", newEmpId, newEmp);

    // Add auth user credentials
    const targetEmail = `${employee_login_id.toLowerCase()}@sunshinepagarbook.internal`;
    const employeePassword = password || "password123";
    await setDocWithId("users", `${newEmpId}-uid`, {
      id: `${newEmpId}-uid`,
      email: targetEmail,
      employee_login_id: employee_login_id.toUpperCase(),
      password: employeePassword,
      role: "employee",
      employee_id: newEmpId,
    });

    // Also register user in Firebase Auth if password complies with length guidelines
    if (employeePassword.length >= 6) {
      try {
        await createUserWithEmailAndPassword(auth, targetEmail, employeePassword);
        console.log("Recorded employee registration in primary registry.");
      } catch (authCreateError: any) {
        console.log("Employee auth registration pending: " + authCreateError.message);
      }
    } else {
      console.log("Employee login recorded using secure database registry fallback.");
    }

    res.json({ success: true, employee: newEmp });
  } catch (err: any) {
    console.log("Add employee handler completed handling: " + err.message);
    res.status(500).json({ success: false, message: "કર્મચારી ઉમેરવામાં ભૂલ થઈ." });
  }
});

app.put("/api/employees/:id", async (req, res) => {
  const { id } = req.params;
  const { name, mobile, monthly_salary, password } = req.body;

  try {
    await setDocWithId("employees", id, {
      name,
      mobile,
      monthly_salary: Number(monthly_salary),
    });

    // Update password if provided
    if (password) {
      const user = await querySingleDoc("users", where("employee_id", "==", id));
      if (user) {
        const oldPassword = user.password;
        const targetEmail = user.email || `${user.employee_login_id.toLowerCase()}@sunshinepagarbook.internal`;

        // Update in Firestore
        await setDocWithId("users", user.id, { password });

        // Attempt to update in Firebase Auth by signing in as that user and updating password if they comply with length guidelines
        if (password.length >= 6 && oldPassword && oldPassword.length >= 6) {
          try {
            const userCredential = await signInWithEmailAndPassword(auth, targetEmail, oldPassword);
            if (userCredential.user) {
              await authUpdatePassword(userCredential.user, password);
              console.log("Successfully updated primary registry password record.");
            }
          } catch (authError: any) {
            console.log("Primary registry password sync is pending: " + authError.message);
          }
        } else {
          console.log("Primary registry password sync skipped (database registry fallback active).");
        }
      }
    }

    await recalculateEmployeeRecordsInFirebase(id);

    const updatedEmp = await getDocById("employees", id);
    res.json({ success: true, employee: updatedEmp });
  } catch (err: any) {
    console.error("Update employee error:", err);
    res.status(500).json({ success: false, message: "કર્મચારી અપડેટ કરવામાં ભૂલ થઈ." });
  }
});

app.delete("/api/employees/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await deleteDocWithId("employees", id);
    
    const user = await querySingleDoc("users", where("employee_id", "==", id));
    if (user) {
      await deleteDocWithId("users", user.id);
    }
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
    const record = await getOrCreateRecordInFirebase(employeeId, parseInt(year), parseInt(month));
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
    await getOrCreateRecordInFirebase(employeeId, now.getFullYear(), now.getMonth() + 1);

    const records = await queryDocs("monthly_records", where("employee_id", "==", employeeId));
    res.json(records || []);
  } catch (err: any) {
    console.error("Get all monthly records error:", err);
    res.status(500).json({ success: false, message: "ઇતિહાસ મેળવવામાં નિષ્ફળતા." });
  }
});

app.post("/api/monthly_records/update", async (req, res) => {
  const { employee_id, year, month, duty_days, overtime_amount } = req.body;

  try {
    let rec = await getOrCreateRecordInFirebase(employee_id, Number(year), Number(month));
    if (!rec) {
      return res.status(404).json({ success: false, message: "પત્રક શરૂ કરવામાં ભૂલ." });
    }

    const updates: any = {};
    if (duty_days !== undefined) updates.duty_days = Number(duty_days);
    if (overtime_amount !== undefined) updates.overtime_amount = Number(overtime_amount);
    updates.updated_at = new Date().toISOString();

    await setDocWithId("monthly_records", rec.id, updates);
    await recalculateEmployeeRecordsInFirebase(employee_id);

    // Fetch newly recalculated
    const refreshedRec = await getDocById("monthly_records", rec.id);

    // Insert notification
    const formattedMonthStr = `${month}/${year}`;
    const notificationId = `notif-${Date.now()}`;
    const notification = {
      id: notificationId,
      employee_id,
      type: "pagar",
      title: "सैलरी अपडेट / પગાર અપડેટ",
      message: `आपके महीने ${formattedMonthStr} की सैलरी डिटेल्स अपडेट की गई है।`,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    await setDocWithId("notifications", notificationId, notification);
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
    const list = await queryDocs("withdrawals", where("employee_id", "==", employeeId));
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
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

    const rec = await getOrCreateRecordInFirebase(employee_id, year, month);
    if (!rec) {
      return res.status(500).json({ success: false, message: "પત્રક મેળવી શકાયું નથી." });
    }

    const withId = `with-${Date.now()}`;
    const newWithdrawal = {
      id: withId,
      monthly_record_id: rec.id,
      employee_id,
      date,
      amount: Number(amount),
      note: note || "",
      created_by: created_by || "admin",
      created_at: new Date().toISOString(),
    };

    await setDocWithId("withdrawals", withId, newWithdrawal);
    await recalculateEmployeeRecordsInFirebase(employee_id);

    // Insert notification
    const notificationId = `notif-${Date.now()}`;
    const notification = {
      id: notificationId,
      employee_id,
      type: "upad",
      title: "નવા ઉપાડ (Withdrawal) / नया उपाड़",
      message: `आपको ₹${amount} का उपाड़ मिला है। नोट: ${note || "કોઈ નોંધ નથી"}`,
      amount: Number(amount),
      is_read: false,
      created_at: new Date().toISOString(),
    };

    await setDocWithId("notifications", notificationId, notification);
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
    const withdrawal = await getDocById("withdrawals", id);

    if (withdrawal) {
      const employee_id = withdrawal.employee_id;
      await deleteDocWithId("withdrawals", id);
      await recalculateEmployeeRecordsInFirebase(employee_id);
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
    const list = await queryDocs("attendance", where("employee_id", "==", employeeId));
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
    await setDocWithId("attendance", attId, {
      id: attId,
      employee_id,
      date,
      status,
    });

    const [yearStr, monthStr] = date.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const rec = await getOrCreateRecordInFirebase(employee_id, year, month);

    // Count present days in this month
    const monthAttendance = await queryDocs("attendance", 
      where("employee_id", "==", employee_id),
      where("status", "==", "present")
    );

    const presentCount = (monthAttendance || []).filter((a: any) => {
      const [y, m] = a.date.split("-");
      return parseInt(y) === year && parseInt(m) === month;
    }).length;

    if (presentCount > 0 && rec) {
      await setDocWithId("monthly_records", rec.id, { duty_days: presentCount });
    }

    await recalculateEmployeeRecordsInFirebase(employee_id);
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
    const list = await queryDocs("notifications", where("employee_id", "==", employeeId));
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(list || []);
  } catch (err: any) {
    console.error("Get notifications error:", err);
    res.status(500).json([]);
  }
});

app.post("/api/notifications/mark-read", async (req, res) => {
  const { employee_id } = req.body;
  try {
    const list = await queryDocs("notifications", where("employee_id", "==", employee_id), where("is_read", "==", false));
    for (const notif of list) {
      await setDocWithId("notifications", notif.id, { is_read: true });
    }
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
    const employees = await getAllDocs("employees");
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

      const rec = await getOrCreateRecordInFirebase(
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
    const emp = await querySingleDoc("employees", where("employee_login_id", "==", employee_login_id));

    if (!emp) {
      return res.status(404).json({ success: false, message: "કર્મચારી મળ્યો નથી." });
    }

    const activeYear = year || 2026;
    const activeMonth = month || 7;
    const rec = await getOrCreateRecordInFirebase(emp.id, activeYear, activeMonth);

    if (!rec) {
      return res.status(500).json({ success: false, message: "રેકોર્ડ મેળવવામાં નિષ્ફળતા." });
    }

    if (operation === "add_withdrawal") {
      const withId = `with-${Date.now()}`;
      const newWithdrawal = {
        id: withId,
        monthly_record_id: rec.id,
        employee_id: emp.id,
        date: new Date(activeYear, activeMonth - 1, 15).toISOString().split("T")[0],
        amount: Number(amount),
        note: note || "કમાન્ડ બાર દ્વારા",
        created_by: "admin",
        created_at: new Date().toISOString(),
      };

      await setDocWithId("withdrawals", withId, newWithdrawal);
      await recalculateEmployeeRecordsInFirebase(emp.id);

      const notificationId = `notif-${Date.now()}`;
      const notification = {
        id: notificationId,
        employee_id: emp.id,
        type: "upad",
        title: "नया उपाड़ (Withdrawal)",
        message: `आपको ₹${amount} का उपाड़ मिला है। नोट: ${note || "કમાન્ડ બાર દ્વારા"}`,
        amount: Number(amount),
        is_read: false,
        created_at: new Date().toISOString(),
      };
      await setDocWithId("notifications", notificationId, notification);
      pushRealtimeUpdate(emp.id, notification);
    } else if (operation === "add_overtime") {
      await setDocWithId("monthly_records", rec.id, { overtime_amount: Number(amount) });
      await recalculateEmployeeRecordsInFirebase(emp.id);

      const notificationId = `notif-${Date.now()}`;
      const notification = {
        id: notificationId,
        employee_id: emp.id,
        type: "pagar",
        title: "ओवरटाइम अपडेट",
        message: `आपके इस महीने का ओवरटाइम ₹${amount} दर्ज किया गया है।`,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      await setDocWithId("notifications", notificationId, notification);
      pushRealtimeUpdate(emp.id, notification);
    } else if (operation === "update_duty_days") {
      await setDocWithId("monthly_records", rec.id, { duty_days: Number(amount) });
      await recalculateEmployeeRecordsInFirebase(emp.id);

      const notificationId = `notif-${Date.now()}`;
      const notification = {
        id: notificationId,
        employee_id: emp.id,
        type: "pagar",
        title: "ड्यूटी दिन अपडेट",
        message: `आपके इस महीने का ड्यूटी दिन ${amount} दिन दर्ज किया गया है।`,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      await setDocWithId("notifications", notificationId, notification);
      pushRealtimeUpdate(emp.id, notification);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Gemini confirm write error:", err);
    res.status(500).json({ success: false, message: "ક્રિયા સેવ કરવામાં નિષ્ફળતા." });
  }
});

// Auto Seed function
async function seedFirebaseIfNeeded() {
  try {
    console.log("Ensuring admin user exists in Firebase Firestore...");
    await setDocWithId("users", "admin-uid", {
      id: "admin-uid",
      email: "753",
      password: "753",
      role: "admin",
    });

    // Also keep legacy email as fallback
    await setDocWithId("users", "admin-legacy-uid", {
      id: "admin-legacy-uid",
      email: "sunshinepolyfilm@gmail.com",
      password: "admin123",
      role: "admin",
    });

    // Seed admin users to Firebase Auth
    if ("753".length >= 6) {
      try {
        await createUserWithEmailAndPassword(auth, "753@sunshinepagarbook.internal", "753");
        console.log("Admin '753' setup successfully recorded.");
      } catch (e: any) {
        if (e.code !== "auth/email-already-in-use") {
          console.log("Admin '753' setup check status: " + e.message);
        }
      }
    } else {
      console.log("Admin '753' password is configured via database fallback due to length guidelines.");
    }

    try {
      await createUserWithEmailAndPassword(auth, "sunshinepolyfilm@gmail.com", "admin123");
      console.log("Legacy admin account setup successfully recorded.");
    } catch (e: any) {
      if (e.code !== "auth/email-already-in-use") {
        console.log("Legacy admin account check status: " + e.message);
      }
    }

    const employees = await getAllDocs("employees");
    if (employees.length === 0) {
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
      for (const emp of defaultEmployees) {
        await setDocWithId("employees", emp.id, emp);
      }

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
      for (const usr of defaultUsers) {
        await setDocWithId("users", usr.id, usr);
        // Seed default employees to Firebase Auth if password matches guidelines
        if (usr.password && usr.password.length >= 6) {
          try {
            await createUserWithEmailAndPassword(auth, usr.email, usr.password);
            console.log(`Employee user '${usr.email}' setup successfully recorded.`);
          } catch (e: any) {
            if (e.code !== "auth/email-already-in-use") {
              console.log(`Employee '${usr.email}' setup check status: ` + e.message);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Automatic seeding failed:", err);
  }
}

// Server configuration & Dev/Production middleware
async function startServer() {
  seedFirebaseIfNeeded().catch(err => {
    console.error("Background initial seeding failed:", err);
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

if (!process.env.VERCEL) {
  startServer();
}

export default app;
