-- Part 2 - SQL | MedAppoint | PostgreSQL
-- Model verified against the read-only database and API documentation:
-- appointments.patient_id -> users.id; appointments.doctor_id -> doctors.id;
-- payments.appointment_id -> appointments.id.
-- Query 1 uses patient ID 85, resolved from the configured application account.
-- Change that ID to reuse the query for another patient. The database login
-- is a shared read-only role, not the application's patient identity.
-- Queries 2-5 cover the whole system. All statements are read-only SELECTs.

-- 1. List all my appointments, with doctor name, date, time slot and status,
-- newest date first. Include every appointment status.
SELECT
    a.id AS appointment_id,
    CONCAT_WS(' ', d.first_name, d.last_name) AS doctor_name,
    a.appointment_date,
    a.time_slot,
    a.status
FROM public.appointments AS a
LEFT JOIN public.doctors AS d ON d.id = a.doctor_id
WHERE a.patient_id = 85
ORDER BY a.appointment_date DESC, a.time_slot DESC, a.id DESC;

-- 2. Count appointments in every status for every doctor, including inactive
-- doctors. LEFT JOIN and COUNT(a.id) give zero for doctors with no appointments.
SELECT
    d.id AS doctor_id,
    CONCAT_WS(' ', d.first_name, d.last_name) AS doctor_name,
    COUNT(a.id) AS total_appointments
FROM public.doctors AS d
LEFT JOIN public.appointments AS a ON a.doctor_id = d.id
GROUP BY d.id, d.first_name, d.last_name
ORDER BY total_appointments DESC, d.id;

-- 3. Find future-dated appointments assigned to currently inactive doctors,
-- showing the doctor, date, appointment status and patient name.
-- "Future" means a calendar date after today in the database session's time
-- zone; today's appointments are excluded. All statuses are included because
-- the question does not restrict them. An empty result means none were found.
SELECT
    a.id AS appointment_id,
    CONCAT_WS(' ', d.first_name, d.last_name) AS doctor_name,
    a.appointment_date,
    a.status AS appointment_status,
    CONCAT_WS(' ', u.first_name, u.last_name) AS patient_name
FROM public.appointments AS a
JOIN public.doctors AS d ON d.id = a.doctor_id
LEFT JOIN public.users AS u ON u.id = a.patient_id
WHERE d.is_active IS FALSE
  AND a.appointment_date > CURRENT_DATE
ORDER BY a.appointment_date, d.id, a.id;

-- 4. Identify duplicate assignments for the same doctor, date and stored time
-- slot, and count the appointments in each conflict. This follows the question's
-- definition across all dates and statuses, including cancelled appointments.
-- For an operational view that excludes cancellations, add
-- WHERE a.status <> 'cancelled' before GROUP BY.
SELECT
    d.id AS doctor_id,
    CONCAT_WS(' ', d.first_name, d.last_name) AS doctor_name,
    a.appointment_date,
    a.time_slot,
    COUNT(*) AS appointment_count
FROM public.appointments AS a
JOIN public.doctors AS d ON d.id = a.doctor_id
GROUP BY d.id, d.first_name, d.last_name, a.appointment_date, a.time_slot
HAVING COUNT(*) > 1
ORDER BY a.appointment_date DESC, a.time_slot, d.id;

-- 5. Sum collected revenue per doctor and calculate each doctor's percentage
-- of overall collected revenue, highest revenue first. The API calls completed
-- payments 'paid'; use payment status, not appointment status or consultation fee.
-- Each paid payment contributes once. Pending/refunded payments are excluded.
-- Include doctors with zero revenue; return 0% if overall revenue is zero.
WITH doctor_revenue AS (
    SELECT
        d.id AS doctor_id,
        CONCAT_WS(' ', d.first_name, d.last_name) AS doctor_name,
        COALESCE(SUM(p.amount), 0) AS total_revenue
    FROM public.doctors AS d
    LEFT JOIN public.appointments AS a ON a.doctor_id = d.id
    LEFT JOIN public.payments AS p
        ON p.appointment_id = a.id
       AND p.status = 'paid'
    GROUP BY d.id, d.first_name, d.last_name
)
SELECT
    doctor_id,
    doctor_name,
    total_revenue,
    COALESCE(
        ROUND(100.0 * total_revenue / NULLIF(SUM(total_revenue) OVER (), 0), 2),
        0
    ) AS percentage_of_total
FROM doctor_revenue
ORDER BY total_revenue DESC, doctor_id;
