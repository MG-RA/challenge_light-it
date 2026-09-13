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

  /** Same request context (and cookie jar) with a different bearer token. */
  withToken(token: string | undefined): ApiClient {
    return new ApiClient(this.request, token);
  }

  private send(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: unknown,
  ): Promise<APIResponse> {
    const headers = this.token ? { Authorization: `Bearer ${this.token}` } : undefined;
    return this.request.fetch(url, { method, headers, data });
  }

  // --- Auth ---
  login(body: LoginRequest): Promise<APIResponse> {
    return this.send('POST', '/api/auth/login', body);
  }

  logout(): Promise<APIResponse> {
    return this.send('POST', '/api/auth/logout');
  }

  // --- Users ---
  getMe(): Promise<APIResponse> {
    return this.send('GET', '/api/users/me');
  }

  updateMe(body: Partial<UpdateProfileRequest>): Promise<APIResponse> {
    return this.send('PUT', '/api/users/me', body);
  }

  // --- Doctors ---
  listDoctors(): Promise<APIResponse> {
    return this.send('GET', '/api/doctors');
  }

  getDoctor(id: number | string): Promise<APIResponse> {
    return this.send('GET', `/api/doctors/${id}`);
  }

  getDoctorAvailability(id: number | string): Promise<APIResponse> {
    return this.send('GET', `/api/doctors/${id}/availability`);
  }

  // --- Appointments ---
  listAppointments(): Promise<APIResponse> {
    return this.send('GET', '/api/appointments');
  }

  getAppointment(id: number | string): Promise<APIResponse> {
    return this.send('GET', `/api/appointments/${id}`);
  }

  createAppointment(body: Partial<CreateAppointmentRequest>): Promise<APIResponse> {
    return this.send('POST', '/api/appointments', body);
  }

  cancelAppointment(id: number | string): Promise<APIResponse> {
    return this.send('PUT', `/api/appointments/${id}/cancel`);
  }

  rescheduleAppointment(
    id: number | string,
    body: RescheduleAppointmentRequest,
  ): Promise<APIResponse> {
    return this.send('PUT', `/api/appointments/${id}/reschedule`, body);
  }

  deleteAppointment(id: number | string): Promise<APIResponse> {
    return this.send('DELETE', `/api/appointments/${id}`);
  }

  // --- Payments ---
  listPayments(): Promise<APIResponse> {
    return this.send('GET', '/api/payments');
  }

  createPayment(body: CreatePaymentRequest): Promise<APIResponse> {
    return this.send('POST', '/api/payments', body);
  }

  // --- Notifications ---
  listNotifications(): Promise<APIResponse> {
    return this.send('GET', '/api/notifications');
  }

  markNotificationRead(id: number | string): Promise<APIResponse> {
    return this.send('PUT', `/api/notifications/${id}/read`);
  }
}
