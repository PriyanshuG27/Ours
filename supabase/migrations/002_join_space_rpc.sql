-- RPC function for joining a space by invite code.
-- This is necessary because the joining user is not yet in the `users` array,
-- so the RLS SELECT policy blocks them from reading the space to update it.
-- This function runs with SECURITY DEFINER to bypass RLS, but performs its
-- own authorization checks internally.

CREATE OR REPLACE FUNCTION join_space(
  p_invite_code text,
  p_user_id uuid,
  p_user_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_id uuid;
  v_users uuid[];
  v_user_names text[];
BEGIN
  -- Verify the caller is actually p_user_id (prevent impersonation)
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Lock the row to prevent race conditions
  SELECT id, users, user_names
    INTO v_space_id, v_users, v_user_names
    FROM spaces
    WHERE invite_code = p_invite_code
      AND is_active = true
    FOR UPDATE;

  IF v_space_id IS NULL THEN
    RAISE EXCEPTION 'Space not found';
  END IF;

  IF array_length(v_users, 1) >= 2 THEN
    RAISE EXCEPTION 'Space is already full';
  END IF;

  IF p_user_id = ANY(v_users) THEN
    RAISE EXCEPTION 'User is already a member';
  END IF;

  UPDATE spaces
    SET users = v_users || p_user_id,
        user_names = v_user_names || p_user_name
    WHERE id = v_space_id;

  RETURN v_space_id;
END;
$$;
