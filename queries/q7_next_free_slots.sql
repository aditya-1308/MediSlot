
-- Q7: Find the next 3 available slots for each doctor
-- in Hyderabad.

WITH ranked_slots AS (
    SELECT
        d.doctor_id,
        u.full_name AS doctor_name,
        sp.name AS specialty_name,
        c.name AS clinic_name,
        c.city,
        sl.slot_id,
        sl.slot_start,
        sl.slot_end,

        ROW_NUMBER() OVER (
            PARTITION BY d.doctor_id
            ORDER BY sl.slot_start ASC
        ) AS slot_rank

    FROM doctor d
    JOIN app_user u
        ON u.user_id = d.doctor_id
    JOIN specialty sp
        ON sp.specialty_id = d.specialty_id
    JOIN clinic c
        ON c.clinic_id = d.clinic_id
    JOIN slot sl
        ON sl.doctor_id = d.doctor_id

    WHERE
        c.city = 'Hyderabad'
        AND sl.status = 'FREE'
        AND sl.slot_start > NOW()
)

SELECT
    doctor_id,
    doctor_name,
    specialty_name,
    clinic_name,
    city,
    slot_id,
    slot_start,
    slot_end
FROM ranked_slots
WHERE slot_rank <= 3
ORDER BY doctor_id, slot_start;
