import type { APIRequestContext, APIResponse } from '@playwright/test';
import type {
  CreateAppointmentRequest,
  CreatePaymentRequest,
  LoginRequest,
  RescheduleAppointmentRequest,
  UpdateProfileRequest,
} from './types';

/**
 * Thin wrapper over the Medical Appointment System API.
 * Methods return the raw APIResponse so tests can assert on status codes and
 * bodies themselves — negative cases matter as much as happy paths here.
 */
export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private token?: string,
  ) {}

  withToken(token: string | undefined): ApiClient {
    return new ApiClient(this.request, token);
  }

  private get headers(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  // --- Auth ---
  login(body: LoginRequest): Promise<APIResponse> {
    return this.request.post('/api/auth/login', { data: body });
  }

  logout(): Promise<APIResponse> {
    return this.request.post('/api/auth/logout', { headers: this.headers });
  }

  // --- Users ---
  getMe(): Promise<APIResponse> {
    return this.request.get('/api/users/me', { headers: this.headers });
  }

  updateMe(body: UpdateProfileRequest): Promise<APIResponse> {
    return this.request.put('/api/users/me', { headers: this.headers, data: body });
  }

  // --- Doctors ---
  listDoctors(): Promise<APIResponse> {
    return this.request.get('/api/doctors', { headers: this.headers });
  }

  getDoctor(id: number | string): Promise<APIResponse> {
    return this.request.get(`/api/doctors/${id}`, { headers: this.headers });
  }

  getDoctorAvailability(id: number | string): Promise<APIResponse> {
    return this.request.get(`/api/doctors/${id}/availability`, { headers: this.headers });
  }

  // --- Appointments ---
  listAppointments(): Promise<APIResponse> {
    return this.request.get('/api/appointments', { headers: this.headers });
  }

  getAppointment(id: number | string): Promise<APIResponse> {
    return this.request.get(`/api/appointments/${id}`, { headers: this.headers });
  }

  createAppointment(body: CreateAppointmentRequest): Promise<APIResponse> {
    return this.request.post('/api/appointments', { headers: this.headers, data: body });
  }

  cancelAppointment(id: number | string): Promise<APIResponse> {
    return this.request.put(`/api/appointments/${id}/cancel`, { headers: this.headers });
  }

  rescheduleAppointment(id: number | string, body: RescheduleAppointmentRequest): Promise<APIResponse> {
    return this.request.put(`/api/appointments/${id}/reschedule`, { headers: this.headers, data: body });
  }

  deleteAppointment(id: number | string): Promise<APIResponse> {
    return this.request.delete(`/api/appointments/${id}`, { headers: this.headers });
  }

  // --- Payments ---
  listPayments(): Promise<APIResponse> {
    return this.request.get('/api/payments', { headers: this.headers });
  }

  createPayment(body: CreatePaymentRequest): Promise<APIResponse> {
    return this.request.post('/api/payments', { headers: this.headers, data: body });
  }

  // --- Notifications ---
  listNotifications(): Promise<APIResponse> {
    return this.request.get('/api/notifications', { headers: this.headers });
  }

  markNotificationRead(id: number | string): Promise<APIResponse> {
    return this.request.put(`/api/notifications/${id}/read`, { headers: this.headers });
  }
}
