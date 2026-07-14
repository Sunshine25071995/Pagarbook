/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Employee {
  id: string;
  name: string;
  mobile: string;
  employee_login_id: string; // e.g. EMP101
  monthly_salary: number;
  created_at: string;
}

export interface MonthlyRecord {
  id: string;
  employee_id: string;
  year: number;
  month: number;
  duty_days: number;
  overtime_amount: number;
  carry_forward_in: number;
  total_earned: number;
  total_withdrawals: number;
  final_salary: number;
  carry_forward_out: number;
  updated_at: string;
}

export interface Withdrawal {
  id: string;
  monthly_record_id: string;
  employee_id: string;
  date: string;
  amount: number;
  note: string;
  created_by: string;
  created_at: string;
}

export interface Notification {
  id: string;
  employee_id: string;
  type: 'upad' | 'pagar' | 'general';
  title: string;
  message: string;
  amount?: number;
  is_read: boolean;
  created_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent';
}

export interface Profile {
  id: string;
  role: 'admin' | 'employee';
  employee_id?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  role: 'admin' | 'employee' | null;
  employee_id?: string;
  user_id?: string;
  name?: string;
  login_id?: string;
}
