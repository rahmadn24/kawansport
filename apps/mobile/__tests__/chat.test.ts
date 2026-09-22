import {
  getMessages,
  getOrCreateConversation,
  listConversations,
  markConversationRead,
  totalUnread,
  validateMessageBody,
  ConversationItem,
} from '../src/api/chat';

describe('chat api (SM-07)', () => {
  it('getOrCreateConversation POST /conversations { partnerId }', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'c1', unreadCount: 0 } });
    await expect(
      getOrCreateConversation('p1', { post } as never),
    ).resolves.toMatchObject({ id: 'c1' });
    expect(post).toHaveBeenCalledWith('/conversations', { partnerId: 'p1' });
  });

  it('listConversations GET /conversations mengembalikan array', async () => {
    const get = jest.fn().mockResolvedValue({
      data: { data: [{ id: 'c1', unreadCount: 2 }] },
    });
    await expect(listConversations({ get } as never)).resolves.toEqual([
      { id: 'c1', unreadCount: 2 },
    ]);
    expect(get).toHaveBeenCalledWith('/conversations');
  });

  it('getMessages GET /conversations/:id/messages dengan page&limit', async () => {
    const get = jest.fn().mockResolvedValue({
      data: { data: [{ id: 'm1', body: 'Halo' }], meta: { page: 1, limit: 20, total: 1 } },
    });
    const res = await getMessages('c1', 1, 20, { get } as never);
    expect(res.meta.total).toBe(1);
    expect(get).toHaveBeenCalledWith('/conversations/c1/messages', {
      params: { page: 1, limit: 20 },
    });
  });

  it('markConversationRead POST /conversations/:id/read', async () => {
    const post = jest.fn().mockResolvedValue({ data: { ok: true, marked: 3 } });
    await expect(markConversationRead('c1', { post } as never)).resolves.toEqual({
      ok: true,
      marked: 3,
    });
    expect(post).toHaveBeenCalledWith('/conversations/c1/read', {});
  });

  it('totalUnread menjumlahkan unreadCount (badge tab Chat)', () => {
    const convs = [{ unreadCount: 2 }, { unreadCount: 0 }, { unreadCount: 5 }] as ConversationItem[];
    expect(totalUnread(convs)).toBe(7);
    expect(totalUnread([])).toBe(0);
  });

  it('validateMessageBody menolak kosong / terlalu panjang', () => {
    expect(validateMessageBody('   ')).toBe('Pesan tidak boleh kosong');
    expect(validateMessageBody('x'.repeat(2001))).toBe('Pesan maksimal 2000 karakter');
    expect(validateMessageBody('Halo!')).toBeNull();
  });
});
