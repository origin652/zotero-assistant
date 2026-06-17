export type SafetyMode = "confirm" | "review" | "open";

export type TaskStatus = "running" | "waiting" | "paused" | "complete" | "failed";

export interface AssistantTask {
  id: string;
  prompt: string;
  status: TaskStatus;
  phase: string;
  messages: unknown[];
  pendingApproval: PendingApproval | null;
  subtasks: string[];
  createdCollections: number;
  summary?: string;
}

export interface PendingApproval {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  details: string;
  rememberKey: string;
}

export interface EventLogEntry {
  time: number;
  type: string;
  data?: unknown;
}

export interface ItemSummary {
  key: string;
  id: number;
  itemType: string;
  title: string;
  creators: string[];
  year: string;
  publicationTitle: string;
  abstractNote: string;
  tags: string[];
  collections: CollectionSummary[];
}

export interface CollectionSummary {
  id: number;
  key: string;
  name: string;
  parentID: number | null;
}
