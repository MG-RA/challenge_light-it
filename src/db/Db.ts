import { Pool, TypeOverrides, types, type PoolConfig, type QueryResultRow } from 'pg';

export type DbConfig = Pick<PoolConfig, 'host' | 'port' | 'database' | 'user' | 'password'>;

// Keep `date` columns as 'YYYY-MM-DD' strings (pg's default Date conversion
// shifts by local timezone, which makes date comparisons with the API flaky).
// Scoped to this pool rather than pg's global parser registry.
const typeOverrides = new TypeOverrides();
typeOverrides.setTypeParser(types.builtins.DATE, (value) => value);

// Row shapes as stored. Deliberately separate from src/api/types.ts: those model
// what the spec claims, while the DB is the oracle they get checked against.
export interface UserRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  notes: string | null;
}

export interface AppointmentRow {
  id: number;
  patient_id: number;
  doctor_id: number;
  appointment_date: string;
  time_slot: string;
  status: string;
}

export interface DoctorRow {
  id: number;
  first_name: string;
  last_name: string;
  specialty: string;
  consultation_fee: string;
  is_active: boolean;
  bio: string | null;
  avatar_url: string | null;
}

export interface PaymentRow {
  id: number;
  appointment_id: number;
  amount: string;
  method: string;
  status: string;
}

export interface NotificationRow {
  id: number;
  user_id: number;
  type: string;
  message: string;
  is_read: boolean;
}

export interface StateAppointmentRow extends AppointmentRow {
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Read-only access to the backing Postgres (Supabase pooler, transaction mode).
 * Used as the source of truth to verify what the API and UI report.
 */
export class Db {
  private readonly pool: Pool;

  constructor(config: DbConfig) {
    this.pool = new Pool({
      ...config,
      // The server cert chains to Supabase's own root CA, so default verification
      // fails (SELF_SIGNED_CERT_IN_CHAIN). Accepted for a read-only test DB; to
      // verify, pass `ca` with the root cert from the project's Database settings.
      ssl: { rejectUnauthorized: false },
      types: typeOverrides,
      max: 2,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 5_000,
      query_timeout: 7_000,
    });
  }

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const { rows } = await this.pool.query<T>(sql, params);
    return rows;
  }

  async one<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const rows = await this.query<T>(sql, params);
    return rows[0];
  }

  /** Like `one`, but a missing row fails with `description` instead of a later TypeError. */
  async oneOrThrow<T extends QueryResultRow>(description: string, sql: string, params: unknown[] = []): Promise<T> {
    const row = await this.one<T>(sql, params);
    if (!row) throw new Error(`Expected a row in the DB: ${description}`);
    return row;
  }

  // --- Common lookups ---
  userByEmail(email: string) {
    return this.oneOrThrow<UserRow>(
      `user with email ${email}`,
      'select id, email, first_name, last_name, phone, notes from users where email = $1',
      [email],
    );
  }

  appointmentsForPatient(patientId: number) {
    return this.query<AppointmentRow>(
      'select id, patient_id, doctor_id, appointment_date, time_slot, status from appointments where patient_id = $1 order by id',
      [patientId],
    );
  }

  /** Any appointment belonging to someone else, for cross-patient authorization checks. */
  otherPatientAppointment(patientId: number) {
    return this.one<{ id: number; patient_id: number }>(
      'select id, patient_id from appointments where patient_id <> $1 order by id limit 1',
      [patientId],
    );
  }

  activeDoctors() {
    return this.query<DoctorRow>(
      'select id, first_name, last_name, specialty, consultation_fee, is_active, bio, avatar_url from doctors where is_active order by id',
    );
  }

  firstActiveDoctor() {
    return this.oneOrThrow<DoctorRow>(
      'an active doctor',
      'select id, first_name, last_name, specialty, consultation_fee, is_active, bio, avatar_url from doctors where is_active order by id limit 1',
    );
  }

  appointmentIdsWithNotes(notes: string) {
    return this.query<{ id: number }>('select id from appointments where notes = $1', [notes]);
  }

  paymentsForPatient(patientId: number) {
    return this.query<PaymentRow>(
      `select p.id, p.appointment_id, p.amount, p.method, p.status
       from payments p join appointments a on a.id = p.appointment_id
       where a.patient_id = $1 order by p.id`,
      [patientId],
    );
  }

  notificationsForUser(userId: number) {
    return this.query<NotificationRow>(
      'select id, user_id, type, message, is_read from notifications where user_id = $1 order by id',
      [userId],
    );
  }

  stateAppointment(id: number, patientId: number) {
    return this.one<StateAppointmentRow>(
      `select id, patient_id, doctor_id, appointment_date, time_slot, status, notes,
       created_at::text, updated_at::text from appointments where id = $1 and patient_id = $2`,
      [id, patientId],
    );
  }

  markedAppointments(marker: string, patientId: number) {
    return this.query<StateAppointmentRow>(
      `select id, patient_id, doctor_id, appointment_date, time_slot, status, notes,
       created_at::text, updated_at::text from appointments where notes = $1 and patient_id = $2 order by id`,
      [marker, patientId],
    );
  }

  paymentsForAppointment(id: number) {
    return this.query<PaymentRow>('select id, appointment_id, amount, method, status from payments where appointment_id = $1 order by id', [id]);
  }

  occupiedSlots(doctorId: number, start: string, end: string) {
    return this.query<{ appointment_date: string; time_slot: string }>(
      `select appointment_date, time_slot from appointments
       where doctor_id = $1 and appointment_date between $2::date and $3::date and status <> 'cancelled'`,
      [doctorId, start, end],
    );
  }

  inactiveDoctor() {
    return this.one<{ id: number }>('select id from doctors where not is_active order by id limit 1');
  }

  /** An id no doctor has, for not-found checks. */
  async unusedDoctorId(): Promise<number> {
    const { id } = await this.oneOrThrow<{ id: number }>('next doctor id', 'select coalesce(max(id), 0)::int + 1 as id from doctors');
    return id;
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
