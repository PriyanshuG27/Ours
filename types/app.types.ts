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

export enum SkipStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export type Task = {
  id: string;
  created_at: string;
  /** E2EE ciphertext */
  title: string;
  assigned_to: string;
  is_completed: boolean;
};

export type SkipRequest = {
  id: string;
  task_id: string;
  requested_by: string;
  status: SkipStatus;
  /** E2EE ciphertext */
  reason: string;
};

export type EnergyLog = {
  id: string;
  created_at: string;
  user_id: string;
  level: number;
  /** E2EE ciphertext */
  note: string;
};

export type Question = {
  id: string;
  /** E2EE ciphertext */
  text: string;
  asked_by: string;
};

export type QAResponse = {
  id: string;
  question_id: string;
  user_id: string;
  /** E2EE ciphertext */
  answer: string;
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
