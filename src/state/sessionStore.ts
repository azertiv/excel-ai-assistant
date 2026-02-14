import { create } from "zustand";
import type {
  ChatMessage,
  MemoryState,
  RangeChange,
  TimelineStep,
  TimelineStepId,
  ToolTimelineCard,
  TurnRecord
} from "./types";
import { createId } from "@/utils/ids";

const DEFAULT_TIMELINE_STEPS: TimelineStep[] = [
  { id: "understanding", label: "Understanding your request", status: "pending", details: [] },
  { id: "context", label: "Gathering Excel context", status: "pending", details: [] },
  { id: "planning", label: "Planning actions", status: "pending", details: [] },
  { id: "execution", label: "Executing tools", status: "pending", details: [] },
  { id: "summary", label: "Summarizing results", status: "pending", details: [] }
];

function cloneTimeline(): TimelineStep[] {
  return DEFAULT_TIMELINE_STEPS.map((step) => ({ ...step, details: [] }));
}

interface SessionStoreState {
  currentTurnId: string | null;
  messages: ChatMessage[];
  timelineSteps: TimelineStep[];
  toolCards: ToolTimelineCard[];
  rangeChanges: RangeChange[];
  turnRecords: TurnRecord[];
  memory: MemoryState | null;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  startTurn: (prompt: string) => string;
  finishTurn: () => void;
  addMessage: (message: Omit<ChatMessage, "id" | "createdAt"> & { id?: string }) => string;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  appendToMessage: (id: string, chunk: string) => void;
  replaceMessages: (messages: ChatMessage[]) => void;
  resetTimeline: () => void;
  setTimelineStep: (id: TimelineStepId, status: TimelineStep["status"], detail?: string) => void;
  addToolCard: (card: Omit<ToolTimelineCard, "id"> & { id?: string }) => string;
  updateToolCard: (id: string, patch: Partial<ToolTimelineCard>) => void;
  addRangeChange: (change: RangeChange) => void;
  markRangeChangeReverted: (changeId: string) => void;
  clearRangeChanges: () => void;
  setMemory: (memory: MemoryState | null) => void;
  addTurnRecord: (record: TurnRecord) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  currentTurnId: null,
  messages: [],
  timelineSteps: cloneTimeline(),
  toolCards: [],
  rangeChanges: [],
  turnRecords: [],
  memory: null,
  busy: false,
  setBusy: (busy) => set({ busy }),
  startTurn: (prompt) => {
    const turnId = createId("turn");
    set((state) => ({
      currentTurnId: turnId,
      timelineSteps: cloneTimeline(),
      toolCards: [],
      messages: [
        ...state.messages,
        {
          id: createId("msg"),
          role: "user",
          content: prompt,
          createdAt: new Date().toISOString()
        }
      ]
    }));
    return turnId;
  },
  finishTurn: () => set({ currentTurnId: null }),
  addMessage: (message) => {
    const id = message.id ?? createId("msg");
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id,
          createdAt: new Date().toISOString(),
          ...message
        }
      ]
    }));
    return id;
  },
  updateMessage: (id, patch) => {
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id
          ? {
              ...message,
              ...patch
            }
          : message
      )
    }));
  },
  appendToMessage: (id, chunk) => {
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id
          ? {
              ...message,
              content: `${message.content}${chunk}`
            }
          : message
      )
    }));
  },
  replaceMessages: (messages) => set({ messages }),
  resetTimeline: () => set({ timelineSteps: cloneTimeline(), toolCards: [] }),
  setTimelineStep: (id, status, detail) => {
    set((state) => ({
      timelineSteps: state.timelineSteps.map((step) => {
        if (step.id !== id) {
          return step;
        }
        return {
          ...step,
          status,
          details: detail ? [...step.details, detail] : step.details
        };
      })
    }));
  },
  addToolCard: (card) => {
    const id = card.id ?? createId("tool");
    set((state) => ({
      toolCards: [
        ...state.toolCards,
        {
          id,
          ...card
        }
      ]
    }));
    return id;
  },
  updateToolCard: (id, patch) => {
    set((state) => ({
      toolCards: state.toolCards.map((toolCard) =>
        toolCard.id === id
          ? {
              ...toolCard,
              ...patch
            }
          : toolCard
      )
    }));
  },
  addRangeChange: (change) => {
    set((state) => ({
      rangeChanges: [change, ...state.rangeChanges]
    }));
  },
  markRangeChangeReverted: (changeId) => {
    set((state) => ({
      rangeChanges: state.rangeChanges.map((change) =>
        change.id === changeId
          ? {
              ...change,
              reverted: true
            }
          : change
      )
    }));
  },
  clearRangeChanges: () => set({ rangeChanges: [] }),
  setMemory: (memory) => set({ memory }),
  addTurnRecord: (record) => {
    set((state) => ({
      turnRecords: [record, ...state.turnRecords]
    }));
  },
  clearSession: () => set({ messages: [], timelineSteps: cloneTimeline(), toolCards: [], rangeChanges: [], turnRecords: [], memory: null })
}));
