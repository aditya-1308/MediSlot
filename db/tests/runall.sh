#!/bin/bash
# Master runner for MediSlot database initialization and testing

set -e

DB_NAME="medislot_test"
echo "=> Dropping existing test database (if any)..."
dropdb --if-exists $DB_NAME

echo "=> Creating fresh test database '$DB_NAME'..."
createdb $DB_NAME

echo "=> Loading Schema Files (01 to 06)..."
psql -d $DB_NAME -v ON_ERROR_STOP=1 -f db/01_tables.sql -q
psql -d $DB_NAME -v ON_ERROR_STOP=1 -f db/02_schedule.sql -q
psql -d $DB_NAME -v ON_ERROR_STOP=1 -f db/03_booking.sql -q
psql -d $DB_NAME -v ON_ERROR_STOP=1 -f db/04_clinical.sql -q
psql -d $DB_NAME -v ON_ERROR_STOP=1 -f db/05_reports.sql -q
psql -d $DB_NAME -v ON_ERROR_STOP=1 -f db/06_indexes.sql -q

echo "=> Loading seed data..."
psql -d $DB_NAME -v ON_ERROR_STOP=1 -f db/seed.sql -q

echo "=> Running All Test Suites..."

echo "--- Testing Schedule Constraints (R2, R4, R5, R8) ---"
psql -d $DB_NAME -v ON_ERROR_STOP=1 -f db/tests/test_schedule.sql

echo "--- Testing Booking Constraints (R1, R3, R7, R9) ---"
psql -d $DB_NAME -v ON_ERROR_STOP=1 -f db/tests/test_booking.sql

echo "--- Testing Clinical Constraints (R6) ---"
psql -d $DB_NAME -v ON_ERROR_STOP=1 -f db/tests/test_clinical.sql

echo "=> Test run complete."
