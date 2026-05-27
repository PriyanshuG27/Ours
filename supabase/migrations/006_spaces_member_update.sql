-- Allow space members to update their own space.
-- This is needed for saving the E2EE test payload (encrypted_test_payload)
-- and space_name updates.
CREATE POLICY "Space members can update their space" ON spaces
  FOR UPDATE
  USING (auth.uid() = ANY(users))
  WITH CHECK (auth.uid() = ANY(users));
