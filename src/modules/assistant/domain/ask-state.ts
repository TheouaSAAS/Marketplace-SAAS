import type { AssistantResult } from "./rag";

/** État du formulaire de question (action serveur passée au panneau). */
export interface AskState {
  status: "idle" | "error" | "done";
  question: string;
  message?: string;
  result?: AssistantResult;
}

export const INITIAL_ASK_STATE: AskState = { status: "idle", question: "" };

export type AskAction = (previous: AskState, formData: FormData) => Promise<AskState>;
