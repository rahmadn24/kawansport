/**
 * Unit test GAP-01 (notifikasi + invite) + GAP-02 (pesan REST + hapus akun)
 * sisi mobile. Kontrak server: apps/api/ENDPOINTS.md seksi GAP-01/GAP-02.
 */
import { sendMessageRest, validateMessageBody } from '../src/api/chat';
import {
  countUnreadNotifications,
  listMyNotifications,
  markNotificationRead,
} from '../src/api/notifications';
import {
  acceptInvite,
  declineInvite,
  inviteStatusLabel,
  listMyInvites,
  sendInvite,
  validateInviteInput,
} from '../src/api/invites';
import { deleteMyAccount } from '../src/api/profile';

describe('chat REST fallback (GAP-02)', () => {
  it('sendMessageRest POST /conversations/:id/messages { body } -> 201', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'm1', body: 'Halo' } });
    await expect(sendMessageRest('c1', 'Halo', { post } as never)).resolves.toMatchObject({
      id: 'm1',
    });
    expect(post).toHaveBeenCalledWith('/conversations/c1/messages', { body: 'Halo' });
  });

  it('validasi body dipakai ulang sebelum kirim (WS maupun REST)', () => {
    expect(validateMessageBody('   ')).toBe('Pesan tidak boleh kosong');
    expect(validateMessageBody('ok')).toBeNull();
  });
});

describe('notifications api (GAP-01)', () => {
  it('listMyNotifications GET /notifications/me dengan page&limit', async () => {
    const get = jest.fn().mockResolvedValue({
      data: { data: [{ id: 'n1', readAt: null }], meta: { page: 1, limit: 20, total: 1 } },
    });
    const res = await listMyNotifications(1, 20, { get } as never);
    expect(res.meta.total).toBe(1);
    expect(get).toHaveBeenCalledWith('/notifications/me', { params: { page: 1, limit: 20 } });
  });

  it('markNotificationRead POST /notifications/:id/read', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'n1', readAt: '2026-01-01' } });
    await expect(markNotificationRead('n1', { post } as never)).resolves.toMatchObject({
      id: 'n1',
    });
    expect(post).toHaveBeenCalledWith('/notifications/n1/read', {});
  });

  it('countUnreadNotifications menghitung readAt null', () => {
    const items = [{ readAt: null }, { readAt: 'x' }, { readAt: null }] as never[];
    expect(countUnreadNotifications(items)).toBe(2);
    expect(countUnreadNotifications([])).toBe(0);
  });
});

describe('invites api (GAP-01)', () => {
  it('validateInviteInput menolak tujuan kosong / sport & pesan kepanjangan', () => {
    expect(validateInviteInput({ toUserId: '  ' })).toBe('Tujuan undangan wajib diisi');
    expect(validateInviteInput({ toUserId: 'u1', sport: 'x'.repeat(61) })).toBe(
      'Cabang olahraga maksimal 60 karakter',
    );
    expect(validateInviteInput({ toUserId: 'u1', message: 'x'.repeat(501) })).toBe(
      'Pesan undangan maksimal 500 karakter',
    );
    expect(validateInviteInput({ toUserId: 'u1' })).toBeNull();
  });

  it('sendInvite POST /invites (validasi lokal dulu, tanpa POST bila invalid)', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'i1', status: 'pending' } });
    await expect(sendInvite({ toUserId: 'u1' }, { post } as never)).resolves.toMatchObject({
      id: 'i1',
    });
    expect(post).toHaveBeenCalledWith('/invites', { toUserId: 'u1' });
    await expect(sendInvite({ toUserId: '' }, { post } as never)).rejects.toThrow(
      'Tujuan undangan wajib diisi',
    );
  });

  it('listMyInvites default masuk tanpa ?dir; sent memakai ?dir=sent', async () => {
    const get = jest.fn().mockResolvedValue({ data: { data: [{ id: 'i1' }] } });
    await expect(listMyInvites('in', { get } as never)).resolves.toEqual([{ id: 'i1' }]);
    expect(get).toHaveBeenCalledWith('/invites/me', undefined);
    await expect(listMyInvites('sent', { get } as never)).resolves.toEqual([{ id: 'i1' }]);
    expect(get).toHaveBeenCalledWith('/invites/me', { params: { dir: 'sent' } });
  });

  it('acceptInvite / declineInvite POST ke endpoint aksi', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'i1', status: 'accepted' } });
    await expect(acceptInvite('i1', { post } as never)).resolves.toMatchObject({ id: 'i1' });
    expect(post).toHaveBeenCalledWith('/invites/i1/accept', {});
    await expect(declineInvite('i2', { post } as never)).resolves.toMatchObject({ id: 'i1' });
    expect(post).toHaveBeenCalledWith('/invites/i2/decline', {});
  });

  it('inviteStatusLabel bahasa manusia', () => {
    expect(inviteStatusLabel('pending')).toBe('Menunggu');
    expect(inviteStatusLabel('accepted')).toBe('Diterima');
    expect(inviteStatusLabel('declined')).toBe('Ditolak');
    expect(inviteStatusLabel('expired')).toBe('Kedaluwarsa');
  });
});

describe('deleteMyAccount (GAP-02)', () => {
  it('DELETE /me -> { ok: true }', async () => {
    const http = { delete: jest.fn().mockResolvedValue({ data: { ok: true } }) } as never;
    await expect(deleteMyAccount(http)).resolves.toEqual({ ok: true });
    expect((http as { delete: jest.Mock }).delete).toHaveBeenCalledWith('/me');
  });
});
