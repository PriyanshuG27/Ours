export type Space = {
  id: string;
  created_at: string;
  invite_code: string;
  users: string[];
  user_names: string[];
  space_name: string | null;
  is_active: boolean;
  /** E2EE test payload — used to verify key correctness on new devices */
  encrypted_test_payload: string | null;
};

export type FeedEventType =
  | "photo"
  | "note"
  | "task_done"
  | "mood"
  | "watch_session"
  | "focus_session"
  | "capture";

export type FeedEvent = {
  id: string;
  created_at: string;
  space_id: string;
  author_id: string;
  type: FeedEventType;
  media_url: string | null;
  /** TODO: Phase 4 — E2EE ciphertext */
  encrypted_caption: string | null;
  metadata: Record<string, unknown>;
  is_pinned: boolean;
};

export type Rule = {
  id: string;
  created_at: string;
  /** E2EE ciphertext */
  title: string;
  /** E2EE ciphertext */
  description: string;
  created_by: string;
};

export type LedgerEntry = {
  id: string;
  created_at: string;
  amount: number;
  payer_id: string;
  /** E2EE ciphertext */
  description: string;
};

export type SkipStatus = "pending" | "approved" | "denied";

export type Task = {
  id: string;
  created_at: string;
  space_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  streak_count: number;
  last_completed_at: string | null;
  is_active: boolean;
  is_coop: boolean;
  shared_streak_count: number;
  partner_streak_count: number;
  photo_proofs_count: number;
  streak_freezes: number;
  completions?: TaskCompletion[];
};

export type TaskCompletion = {
  id: string;
  task_id: string;
  completed_by: string;
  completed_at: string;
  mood_tag: MoodTag;
  streak_at_completion: number;
  photo_path?: string | null;
  is_flagged?: boolean;
};

export type SkipRequest = {
  id: string;
  created_at: string;
  task_id: string;
  requester_id: string;
  reason: string | null;
  status: SkipStatus;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type EnergyLog = {
  id: string;
  space_id: string;
  user_id: string;
  date: string;
  morning_level: number | null;
  night_level: number | null;
};

export type Question = {
  id: string;
  question_text: string;
  display_order: number;
};

export type QuestionResponse = {
  id: string;
  space_id: string;
  user_id: string;
  question_id: string;
  date: string;
  encrypted_answer: string;
};

export enum BoardColumn {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  DONE = "done",
}

export type BoardCard = {
  id: string;
  column: BoardColumn;
  /** E2EE ciphertext */
  title: string;
  /** E2EE ciphertext */
  content: string;
};

export enum BucketItemStatus {
  PLANNED = "planned",
  DONE = "done",
}

export type BucketItem = {
  id: string;
  status: BucketItemStatus;
  /** E2EE ciphertext */
  title: string;
};

export type DictionaryEntry = {
  id: string;
  /** E2EE ciphertext */
  word: string;
  /** E2EE ciphertext */
  definition: string;
};

export type WeeklyStats = {
  id: string;
  week_start: string;
  user_id: string;
  tasks_done: number;
  energy_average: number;
};

export type CaptureEvent = {
  id: string;
  user_id: string;
  /** E2EE ciphertext */
  media_url: string;
};

export enum MoodTag {
  EASY = "easy",
  STRUGGLED = "struggled",
  FORCED = "forced",
  PROUD = "proud",
}
