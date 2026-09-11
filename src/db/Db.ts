import { Pool, types, type QueryResultRow } from 'pg';
import { env } from '../config/env';

// Keep `date` columns as 'YYYY-MM-DD' strings (pg's default Date conversion
// shifts by local timezone, which makes date comparisons with the API flaky).
types.setTypeParser(types.builtins.DATE, (value) => value);

/**
 * Read-only access to the backing Postgres (Supabase pooler, transaction mode).
 * Used as the source of truth to verify what the API and UI report.
 */
export class Db {
  private readonly pool = new Pool({
    ...env.db,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const { rows } = await this.pool.query<T>(sql, params);
    return rows;
  }

  async one<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const rows = await this.query<T>(sql, params);
    return rows[0];
  }

  // --- Common lookups ---
  userByEmail(email: string) {
    return this.one<{ id: number; email: string; first_name: string; last_name: string; phone: string | null; notes: string | null }>(
      'select id, email, first_name, last_name, phone, notes from users where email = $1',
      [email],
    );
  }

  appointmentsForPatient(patientId: number) {
    return this.query<{ id: number; doctor_id: number; appointment_date: string; time_slot: string; status: string }>(
      'select id, doctor_id, appointment_date, time_slot, status from appointments where patient_id = $1 order by appointment_date, time_slot',
      [patientId],
    );
  }

  activeDoctors() {
    return this.query<{ id: number; first_name: string; last_name: string; specialty: string; consultation_fee: string }>(
      'select id, first_name, last_name, specialty, consultation_fee from doctors where is_active order by id',
    );
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
