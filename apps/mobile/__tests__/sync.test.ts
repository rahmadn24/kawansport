import {
  createDispute,
  disputeCategoryLabel,
  disputeStatusLabel,
  listMyDisputes,
  validateCreateDispute,
} from '../src/api/disputes';
import {
  getPayoutBalance,
  listMyPayouts,
  payoutStatusLabel,
  requestPayout,
  validateRequestPayout,
} from '../src/api/payouts';

describe('disputes api (API-W02)', () => {
  it('createDispute POST /disputes', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'd1', status: 'open' } });
    const input = { targetType: 'booking' as const, targetId: 'b1', category: 'no_show' as const, description: 'Tidak hadir' };
    await expect(createDispute(input, { post } as never)).resolves.toMatchObject({ status: 'open' });
    expect(post).toHaveBeenCalledWith('/disputes', input);
  });

  it('listMyDisputes GET /disputes/me', async () => {
    const get = jest.fn().mockResolvedValue({ data: { data: [{ id: 'd1' }] } });
    await expect(listMyDisputes({ get } as never)).resolves.toEqual([{ id: 'd1' }]);
    expect(get).toHaveBeenCalledWith('/disputes/me');
  });

  it('validateCreateDispute + label', () => {
    const valid = { targetType: 'order' as const, targetId: 'o1', category: 'refund' as const, description: 'Minta refund' };
    expect(validateCreateDispute(valid)).toBeNull();
    expect(validateCreateDispute({ ...valid, description: '  ' })).toBe('Deskripsi wajib diisi');
    expect(disputeCategoryLabel('no_show')).toBe('Tidak hadir');
    expect(disputeStatusLabel('investigating')).toBe('Ditelusuri');
  });
});

describe('payouts api (API-W08)', () => {
  it('getPayoutBalance GET /payouts/balance', async () => {
    const get = jest.fn().mockResolvedValue({ data: { available: 100000 } });
    await expect(
      getPayoutBalance({ payeeType: 'venue', payeeId: 'v1' }, { get } as never),
    ).resolves.toMatchObject({ available: 100000 });
    expect(get).toHaveBeenCalledWith('/payouts/balance', {
      params: { payeeType: 'venue', payeeId: 'v1' },
    });
  });

  it('requestPayout POST /payouts', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'p1', status: 'requested' } });
    const input = { payeeType: 'seller' as const, payeeId: 's1', amount: 50000 };
    await expect(requestPayout(input, { post } as never)).resolves.toMatchObject({ status: 'requested' });
    expect(post).toHaveBeenCalledWith('/payouts', input);
  });

  it('listMyPayouts GET /payouts/me', async () => {
    const get = jest.fn().mockResolvedValue({ data: { data: [{ id: 'p1' }] } });
    await expect(listMyPayouts({ get } as never)).resolves.toEqual([{ id: 'p1' }]);
    expect(get).toHaveBeenCalledWith('/payouts/me');
  });

  it('validateRequestPayout + label', () => {
    expect(validateRequestPayout({ payeeType: 'venue', payeeId: 'v1', amount: 1000 })).toBeNull();
    expect(validateRequestPayout({ payeeType: 'venue', payeeId: 'v1', amount: 0 })).toBe(
      'Nominal harus bilangan bulat >= 1',
    );
    expect(payoutStatusLabel('paid')).toBe('Dibayar');
  });
});
