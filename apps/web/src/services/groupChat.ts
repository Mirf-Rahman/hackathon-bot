import { callAction } from "./api";

export type GcMessage = {
  id: string;
  senderUserId: string;
  senderDisplayName?: string;
  text?: string;
  postedAt: string;
  professionalism?: string;
};

export async function listGcMessages(
  conversationId: string,
  limit = 100,
): Promise<GcMessage[]> {
  const out = await callAction<
    { conversationId: string; limit: number },
    { messages: GcMessage[] }
  >("listGcMessages", { conversationId, limit });
  return out.messages;
}

export async function postGcMessage(input: {
  conversationId: string;
  organizationId?: string;
  senderUserId: string;
  senderDisplayName?: string;
  text: string;
}): Promise<void> {
  await callAction<typeof input, { ok: boolean; postedAt: string }>(
    "postGcMessage",
    input,
  );
}
