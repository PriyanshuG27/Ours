-- Add encrypted_voice_note to board_cards
ALTER TABLE board_cards ADD COLUMN IF NOT EXISTS encrypted_voice_note text;
