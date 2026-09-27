import {
  formatEloBadge,
  searchPartners,
  validateSearchPartners,
} from '../src/api/partners';

describe('partners api ELO filter (EL-01)', () => {
  it('searchPartners meneruskan param ELO ke GET /users/search', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        data: [
          { id: 'u1', elo: { sport: 'badminton', score: 1150, provisional: false } },
        ],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });
    const filter = { eloSport: 'badminton', eloMaxDelta: 100, page: 1, limit: 20 };
    const res = await searchPartners(filter, { get } as never);
    expect(get).toHaveBeenCalledWith('/users/search', { params: filter });
    expect(res.data[0].elo).toEqual({ sport: 'badminton', score: 1150, provisional: false });
  });

  it('formatEloBadge: skor + tanda Baru bila provisional', () => {
    expect(formatEloBadge({ sport: 'badminton', score: 1150, provisional: false })).toBe(
      'ELO 1150',
    );
    expect(formatEloBadge({ sport: 'badminton', score: 1000, provisional: true })).toBe(
      'ELO 1000 • Baru',
    );
    expect(formatEloBadge(undefined)).toBe('—');
    expect(formatEloBadge(null)).toBe('—');
  });

  it('validateSearchPartners: batas ELO tanpa cabor ditolak; min>max ditolak', () => {
    expect(validateSearchPartners({ eloSport: 'badminton' })).toBeNull();
    expect(validateSearchPartners({ eloSport: 'badminton', eloMaxDelta: 200 })).toBeNull();
    expect(validateSearchPartners({ eloSport: 'badminton', eloMin: 900, eloMax: 1200 })).toBeNull();
    expect(validateSearchPartners({ eloMin: 900 })).toBe(
      'Cabor ELO wajib diisi bila batas ELO dipakai',
    );
    expect(validateSearchPartners({ eloMaxDelta: 50 })).toBe(
      'Cabor ELO wajib diisi bila batas ELO dipakai',
    );
    expect(validateSearchPartners({ eloSport: 'badminton', eloMin: 1300, eloMax: 1200 })).toBe(
      'ELO min tidak boleh melebihi ELO max',
    );
    expect(validateSearchPartners({ eloSport: 'badminton', eloMaxDelta: -10 })).toBe(
      'Delta ELO harus angka ≥ 0',
    );
    expect(validateSearchPartners({ eloSport: 'badminton', eloMin: NaN })).toBe(
      'ELO min harus angka',
    );
  });

  it('validasi lama SM-06 tetap berlaku bersama filter ELO', () => {
    expect(validateSearchPartners({ eloSport: 'badminton', lat: -6.2 })).toBe(
      'Lat dan Lng harus diisi berpasangan',
    );
  });
});
