/**
 * API chat 1-1 (SM-07): conversations + messages + read.
 *
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';

export interface ChatPartner {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface ConversationItem {
  id: string;
  partner: ChatPartner;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessagesResult {
  data: ChatMessage[];
  meta: { page: number; limit: number; total: number };
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
  post<T>(url: string, body: unknown): Promise<{ data: T }>;
}

/** POST /conversations — get-or-create berdasarkan partnerId. */
export async function getOrCreateConversation(
  partnerId: string,
  http: Http = api,
): Promise<ConversationItem> {
  const res = await http.post<ConversationItem>('/conversations', { partnerId });
  return res.data;
}

/** GET /conversations — list + last message + unread count. */
export async function listConversations(
  http: Http = api,
): Promise<ConversationItem[]> {
  const res = await http.get<{ data: ConversationItem[] }>('/conversations');
  return res.data.data;
}

/** GET /conversations/:id/messages?page&limit — ASC + pagination. */
export async function getMessages(
  conversationId: string,
  page = 1,
  limit = 20,
  http: Http = api,
): Promise<MessagesResult> {
  const res = await http.get<MessagesResult>(`/conversations/${conversationId}/messages`, {
    params: { page, limit },
  });
  return res.data;
}

/** POST /conversations/:id/read — tandai pesan lawan sebagai dibaca. */
export async function markConversationRead(
  conversationId: string,
  http: Http = api,
): Promise<{ ok: boolean; marked: number }> {
  const res = await http.post<{ ok: boolean; marked: number }>(
    `/conversations/${conversationId}/read`,
    {},
  );
  return res.data;
}

/**
 * POST /conversations/:id/messages — kirim pesan via REST (GAP-02).
 * Jalur persist SAMA dengan WS; dipakai sebagai fallback otomatis bila
 * pengiriman WS gagal/timeout. 201: MessageItem.
 */
export async function sendMessageRest(
  conversationId: string,
  body: string,
  http: Http = api,
): Promise<ChatMessage> {
  const res = await http.post<ChatMessage>(
    `/conversations/${conversationId}/messages`,
    { body },
  );
  return res.data;
}

/** Total unread seluruh conversation — untuk badge tab Chat. */
export function totalUnread(conversations: ConversationItem[]): number {
  return conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
}

/** Validasi body pesan sisi klien; pesan error atau null bila valid. */
export function validateMessageBody(body: string): string | null {
  if (!body.trim()) return 'Pesan tidak boleh kosong';
  if (body.trim().length > 2000) return 'Pesan maksimal 2000 karakter';
  return null;
}
