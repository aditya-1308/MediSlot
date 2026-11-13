-- Enforcement of R6: Reviews and prescriptions are only allowed for completed appointments

CREATE OR REPLACE FUNCTION fn_check_completed_appointment()
RETURNS TRIGGER AS $$
DECLARE
    v_status VARCHAR(10);
BEGIN
    SELECT status INTO v_status FROM appointment WHERE appt_id = NEW.appt_id;
    
    -- Using IS DISTINCT FROM safely handles NULL values
    IF v_status IS DISTINCT FROM 'COMPLETED' THEN
        RAISE EXCEPTION 'R6: Action rejected. Clinical records (reviews or prescriptions) can only be added for COMPLETED appointments. Current status: %', COALESCE(v_status, 'NULL');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger now guards both INSERT and UPDATE operations
DROP TRIGGER IF EXISTS trg_enforce_r6_prescription ON prescription_item;
CREATE TRIGGER trg_enforce_r6_prescription
BEFORE INSERT OR UPDATE ON prescription_item
FOR EACH ROW
EXECUTE FUNCTION fn_check_completed_appointment();

-- Trigger now guards both INSERT and UPDATE operations
DROP TRIGGER IF EXISTS trg_enforce_r6_review ON review;
CREATE TRIGGER trg_enforce_r6_review
BEFORE INSERT OR UPDATE ON review
FOR EACH ROW
EXECUTE FUNCTION fn_check_completed_appointment();