// Complete models used only after literal schema + field-completeness validation.
// The raw OpenAPI component properties are optional; SpecData models that distinction.

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface Doctor {
  id: number;
  first_name: string;
  last_name: string;
  specialty: string;
  bio: string | null;
  avatar_url: string | null;
  is_active: boolean;
  /** Decimal serialized as string */
  consultation_fee: string;
}

export type AppointmentStatus = 'active' | 'pending' | 'completed' | 'cancelled';

export interface Appointment {
  id: number;
  patient_id: number;
  doctor_id: number;
  /** YYYY-MM-DD */
  appointment_date: string;
  /** HH:mm */
  time_slot: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'cash' | 'card' | 'insurance';

export interface Payment {
  id: number;
  appointment_id: number;
  amount: string;
  method: PaymentMethod;
  status: 'pending' | 'paid' | 'refunded';
  paid_at: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  message: string;
  isRead: boolean;
  created_at: string;
}

export interface ApiError {
  error: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateAppointmentRequest {
  doctor_id: number;
  appointment_date: string;
  time_slot: string;
  notes?: string;
}

export interface RescheduleAppointmentRequest {
  appointment_date: string;
  time_slot: string;
}

export interface CreatePaymentRequest {
  appointment_id: number;
  amount: number;
  method: PaymentMethod;
}

export interface UpdateProfileRequest {
  first_name: string;
  last_name: string;
  notes?: string;
}
