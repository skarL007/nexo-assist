/**
 * Contrato entre o orquestrador (run.ts) e o processo de cada candidato
 * (run-candidate.ts): o trabalho vai por variável de ambiente, o progresso
 * volta por linhas no stdout com um prefixo fixo.
 */
import { z } from "zod";
import { REASONING_EFFORTS } from "@/agent/model-config";
import { conversationRecordSchema, readJsonl, RESULTS_DIR, type ConversationRecord } from "./records";

export const jobSchema = z.object({
  candidate: z.string(),
  model: z.string(),
  effort: z.enum(REASONING_EFFORTS),
  reps: z.number().int().positive(),
  /** O processo para sozinho ao passar disto (US$). */
  maxSpendUsd: z.number().positive(),
  turnTimeoutMs: z.number().int().positive(),
  scenarioFilter: z.string().optional(),
});
export type CandidateJob = z.infer<typeof jobSchema>;

export const JOB_ENV = "BENCHMARK_JOB";
export const PROGRESS_PREFIX = "@@benchmark ";

export const progressSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("conversation"), scenario: z.string(), rep: z.number(), costUsd: z.number(), passed: z.boolean() }),
  z.object({ type: z.literal("stopped"), reason: z.string() }),
]);
export type Progress = z.infer<typeof progressSchema>;

/** Cada candidato tem seu arquivo de conversas (processos em paralelo não disputam o mesmo arquivo). */
export const conversationsFile = (candidate: string) => `${RESULTS_DIR}/conversas/${candidate}.jsonl`;

export const loadConversations = (candidate: string): ConversationRecord[] =>
  readJsonl(conversationsFile(candidate), conversationRecordSchema);
/** Banco SQLite próprio por candidato, fora do git (*.db está no .gitignore). */
export const databaseFile = (candidate: string) => `evals/benchmark/.work/${candidate}.db`;
