import { getApiClient } from "../stores/clientsStore";

/**
 * Typed wrappers around the bot's two primary surfaces:
 *   - Actions (mutations) → callAction
 *   - Tables (reads)      → findTableRows
 *
 * These are intentionally generic. The strongly-typed helpers in
 * services/<feature>.ts wrap them per business operation.
 */

export async function callAction<TInput = unknown, TOutput = unknown>(
  type: string,
  input: TInput,
): Promise<TOutput> {
  const client = getApiClient() as any;
  const res = await client.callAction({ type, input });
  return (res?.output ?? res) as TOutput;
}

export async function findTableRows<TRow = any>(
  table: string,
  params: {
    filter?: Record<string, any>;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
    limit?: number;
    offset?: number;
    search?: string;
  } = {},
): Promise<TRow[]> {
  const client = getApiClient() as any;
  const res = await client.findTableRows({ table, ...params });
  return (res?.rows ?? []) as TRow[];
}
