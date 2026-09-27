import {
  getVenueLeaderboard,
  leaderboardDisplayName,
  leaderboardRecordLabel,
} from '../src/api/venues';

describe('venue leaderboard api (EL-02)', () => {
  it('getVenueLeaderboard GET /venues/:id/leaderboard dengan filter', async () => {
    const payload = {
      data: [
        { userId: 'u1', displayName: 'Andi', played: 2, wins: 2, losses: 0, elo: 1048 },
        { userId: 'u2', displayName: null, played: 2, wins: 1, losses: 1, elo: 1000 },
      ],
      meta: { venueId: 'v1', sport: 'badminton', total: 2 },
    };
    const get = jest.fn().mockResolvedValue({ data: payload });
    await expect(
      getVenueLeaderboard('v1', { sport: 'badminton', limit: 5 }, { get } as never),
    ).resolves.toEqual(payload);
    expect(get).toHaveBeenCalledWith('/venues/v1/leaderboard', {
      params: { sport: 'badminton', limit: 5 },
    });
  });

  it('getVenueLeaderboard tanpa filter meneruskan params kosong', async () => {
    const payload = { data: [], meta: { venueId: 'v1', sport: null, total: 0 } };
    const get = jest.fn().mockResolvedValue({ data: payload });
    await expect(getVenueLeaderboard('v9', {}, { get } as never)).resolves.toEqual(
      payload,
    );
    expect(get).toHaveBeenCalledWith('/venues/v9/leaderboard', { params: {} });
  });

  it('leaderboardDisplayName jujur: nama asli atau fallback Pemain', () => {
    expect(leaderboardDisplayName({ displayName: 'Andi' })).toBe('Andi');
    expect(leaderboardDisplayName({ displayName: '  Budi  ' })).toBe('Budi');
    expect(leaderboardDisplayName({ displayName: null })).toBe('Pemain');
    expect(leaderboardDisplayName({ displayName: '   ' })).toBe('Pemain');
  });

  it('leaderboardRecordLabel format menang–kalah', () => {
    expect(leaderboardRecordLabel({ played: 7, wins: 5, losses: 2 })).toBe(
      '5M–2K dari 7 main',
    );
    expect(leaderboardRecordLabel({ played: 0, wins: 0, losses: 0 })).toBe(
      '0M–0K dari 0 main',
    );
  });
});
