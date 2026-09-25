import {
  CircleMember,
  fetchMyCircle,
  fetchUserStats,
  formatStatsSummary,
  verifiedLabel,
} from '../src/api/profile';

describe('profile ST-07 terbatas (stats + circle + verified)', () => {
  it('fetchUserStats GET /users/:id/stats', async () => {
    const stats = {
      user: { id: 'u1', displayName: 'A', avatarUrl: null, verified: true },
      totalEventsHosted: 3,
      totalEventsJoined: 5,
      totalBookingsPaid: 2,
      sportsCount: 4,
      sports: ['Futsal'],
    };
    const http = { get: jest.fn().mockResolvedValue({ data: stats }) } as never;
    await expect(fetchUserStats('u1', http)).resolves.toEqual(stats);
    expect((http as { get: jest.Mock }).get).toHaveBeenCalledWith('/users/u1/stats');
  });

  it('fetchMyCircle GET /users/me/circle mengembalikan array data', async () => {
    const members: CircleMember[] = [
      {
        id: 'u2',
        email: 'b@example.com',
        displayName: 'B',
        avatarUrl: null,
        verified: false,
        sports: ['Basket'],
        skillLevel: 'beginner',
      },
    ];
    const http = {
      get: jest.fn().mockResolvedValue({ data: { data: members, meta: { total: 1 } } }),
    } as never;
    await expect(fetchMyCircle(http)).resolves.toEqual(members);
    expect((http as { get: jest.Mock }).get).toHaveBeenCalledWith('/users/me/circle');
  });

  it('formatStatsSummary merangkum 4 angka + verifiedLabel jujur', () => {
    const stats = {
      user: { id: 'u1', displayName: null, avatarUrl: null, verified: true },
      totalEventsHosted: 3,
      totalEventsJoined: 5,
      totalBookingsPaid: 2,
      sportsCount: 4,
      sports: [],
    };
    expect(formatStatsSummary(stats)).toBe('3 Event • 5 Ikut Mabar • 2 Booking • 4 Cabor');
    expect(verifiedLabel(true)).toBe('✓ Terverifikasi');
    expect(verifiedLabel(false)).toBeNull();
    expect(verifiedLabel(undefined)).toBeNull();
    expect(verifiedLabel(null)).toBeNull();
  });
});
