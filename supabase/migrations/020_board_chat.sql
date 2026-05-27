-- Create board_card_messages table
CREATE TABLE IF NOT EXISTS board_card_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES board_cards(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_payload text NOT NULL,
  message_type text NOT NULL, -- 'text', 'voice', 'image', 'call_request'
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE board_card_messages ENABLE ROW LEVEL SECURITY;

-- Allow users to read messages in their space
CREATE POLICY "Users can read messages in their space" ON board_card_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_cards
      JOIN spaces ON spaces.id = board_cards.space_id
      WHERE board_cards.id = board_card_messages.card_id
      AND auth.uid() = ANY(spaces.users)
    )
  );

-- Allow users to insert messages in their space
CREATE POLICY "Users can insert messages in their space" ON board_card_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_cards
      JOIN spaces ON spaces.id = board_cards.space_id
      WHERE board_cards.id = board_card_messages.card_id
      AND auth.uid() = ANY(spaces.users)
    )
  );

-- Insert bucket for media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('board-media', 'board-media', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage
CREATE POLICY "Users can read board media" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'board-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can insert board media" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'board-media' AND auth.role() = 'authenticated');
