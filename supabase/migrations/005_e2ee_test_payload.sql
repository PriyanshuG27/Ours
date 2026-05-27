-- Add encrypted test payload column to spaces table.
-- This stores a known encrypted string used to verify key correctness
-- when a user re-enters their Space Key on a new device.
ALTER TABLE spaces ADD COLUMN encrypted_test_payload text;
