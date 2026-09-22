/**
 * Socket chat SM-07 (socket.io-client).
 *
 * - Auth JWT via `auth.token` (fallback `query.token` di server).
 * - Reconnect otomatis (bawaan socket.io, backoff default).
 * - `useChatSocket` dipakai ChatRoom: join room, kirim message:send,
 *   terima message:new. Bila socket gagal/pollingFallback aktif, ChatRoom
 *   memakai polling GET messages tiap 5 dtk (lihat ChatRoomScreen).
 */
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '../api/client';
import { getTokens } from '../api/tokenStorage';
import type { ChatMessage } from '../api/chat';

export interface ConversationUpdate {
  conversationId: string;
  lastMessage: ChatMessage;
  unreadCount: number;
}

interface Ack {
  ok: boolean;
  error?: string;
  message?: ChatMessage;
}

export function createChatSocket(token: string, baseURL: string = API_URL): Socket {
  return io(baseURL, {
    auth: { token },
    query: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 10000,
  });
}

export async function getStoredAccessToken(): Promise<string | null> {
  const { accessToken } = await getTokens();
  return accessToken ?? null;
}

interface UseChatSocketOptions {
  conversationId: string | null;
  baseURL?: string;
  /** Dipanggil untuk tiap message:new milik conversation aktif. */
  onMessage?: (msg: ChatMessage) => void;
  /** Dipanggil untuk conversation:update (badge/unread list). */
  onConversationUpdate?: (upd: ConversationUpdate) => void;
  enabled?: boolean;
}

export function useChatSocket({
  conversationId,
  baseURL = API_URL,
  onMessage,
  onConversationUpdate,
  enabled = true,
}: UseChatSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const onMessageRef = useRef(onMessage);
  const onUpdateRef = useRef(onConversationUpdate);
  onMessageRef.current = onMessage;
  onUpdateRef.current = onConversationUpdate;

  useEffect(() => {
    if (!enabled || !conversationId) return;
    let closed = false;
    let socket: Socket | null = null;

    getStoredAccessToken()
      .then((token) => {
        if (closed || !token) {
          if (!token) setSocketError('Tidak ada access token — memakai polling.');
          return;
        }
        socket = createChatSocket(token, baseURL);
        socketRef.current = socket;
        socket.on('connect', () => {
          setConnected(true);
          setSocketError(null);
          socket?.emit('join', { conversationId }, () => undefined);
        });
        socket.on('disconnect', () => setConnected(false));
        socket.on('connect_error', (e: Error) => {
          setSocketError(e.message);
          setConnected(false);
        });
        socket.on('message:new', (msg: ChatMessage) => {
          if (msg.conversationId === conversationId) onMessageRef.current?.(msg);
        });
        socket.on('conversation:update', (upd: ConversationUpdate) => {
          onUpdateRef.current?.(upd);
        });
      })
      .catch((e: unknown) => {
        setSocketError(e instanceof Error ? e.message : 'Socket gagal — memakai polling.');
      });

    return () => {
      closed = true;
      socket?.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, conversationId, baseURL]);

  const sendMessage = (body: string): Promise<ChatMessage> =>
    new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected || !conversationId) {
        reject(new Error('Socket belum terhubung'));
        return;
      }
      socket.emit(
        'message:send',
        { conversationId, body },
        (ack: Ack) => {
          if (ack?.ok && ack.message) resolve(ack.message);
          else reject(new Error(ack?.error ?? 'Gagal mengirim pesan'));
        },
      );
    });

  return { connected, socketError, sendMessage };
}
