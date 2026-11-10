// MediSlot | Mohammad Mubeen Khan | server/errors.js
// Turns database errors into readable HTTP responses. The database is the
// only place rules are enforced; this file just translates what it says.
//
// Contract (every trigger owner): raise rule errors as
//   RAISE EXCEPTION 'R<n>: <message>' [USING ERRCODE = ...]
// The R<n> prefix decides the HTTP status. Errors without a prefix fall back
// to their SQLSTATE (constraint violations raised by the DBMS itself).

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Status per business rule
const RULE_STATUS = {
  R1: 409, // slot already booked
  R2: 409, // overlapping doctor slots
  R3: 409, // patient appointment clash
  R4: 400, // bad availability window
  R5: 409, // illegal status transition
  R6: 400, // review/prescription before visit completed
  R7: 400, // cancellation / refund
  R8: 403, // wrong account type
  R9: 400, // slot already started
};

// Fallbacks for constraint errors raised without a rule prefix
const SQLSTATE = {
  '23505': [409, 'That record already exists'],                 // unique_violation
  '23503': [409, 'That refers to something that does not exist or is still in use'], // foreign_key_violation
  '23514': [400, 'A value breaks one of the database rules'],    // check_violation
  '23502': [400, 'A required field is missing'],                 // not_null_violation
  '23P01': [409, 'That overlaps with an existing record'],       // exclusion_violation
  '22P02': [400, 'A value has the wrong format'],                // invalid_text_representation
  '22007': [400, 'A date or time has the wrong format'],         // invalid_datetime_format
  '22008': [400, 'A date or time is out of range'],              // datetime_field_overflow
  '42501': [403, 'You are not allowed to do that'],              // insufficient_privilege
  'P0002': [404, 'Not found'],                                   // no_data_found
};

// Readable names for CHECK / UNIQUE constraints users can actually hit
const CONSTRAINT_MESSAGES = {
  uq_app_user_email: 'An account with that email already exists',
  chk_app_user_email: 'Email address is not valid',
  chk_app_user_phone: 'Phone number must be 10 to 15 digits',
  chk_patient_dob: 'Date of birth is not valid',
  chk_payment_method: 'Payment method must be UPI, CARD, NETBANKING or CASH',
  uq_doctor_license_no: 'A doctor with that licence number already exists',
  chk_doctor_fee: 'Fee cannot be negative',
  chk_review_rating: 'Rating must be between 1 and 5',
};

function translate(err) {
  if (err instanceof HttpError) {
    return { status: err.status, body: { error: err.message } };
  }

  const match = /^(R\d+):\s*(.*)$/s.exec(err.message || '');
  if (match && RULE_STATUS[match[1]]) {
    return { status: RULE_STATUS[match[1]], body: { error: match[2], rule: match[1] } };
  }

  if (err.constraint && CONSTRAINT_MESSAGES[err.constraint]) {
    const [status] = SQLSTATE[err.code] || [400];
    return { status, body: { error: CONSTRAINT_MESSAGES[err.constraint], constraint: err.constraint } };
  }

  if (err.code && SQLSTATE[err.code]) {
    const [status, message] = SQLSTATE[err.code];
    return { status, body: { error: message, constraint: err.constraint } };
  }

  return null;
}

// Express error-handling middleware; mount last
function errorHandler(err, req, res, next) {
  const t = translate(err);
  if (t) return res.status(t.status).json(t.body);
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
}

module.exports = { HttpError, translate, errorHandler };
