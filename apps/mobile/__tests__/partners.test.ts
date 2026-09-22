import {
  formatDistance,
  searchPartners,
  validateSearchPartners,
} from '../src/api/partners';

describe('partners api (SM-06)', () => {
  it('searchPartners GET /users/search dengan params filter', async () => {
    const get = jest.fn().mockResolvedValue({
      data: { data: [{ id: 'u1' }], meta: { page: 1, limit: 20, total: 1 } },
    });
    const filter = { sport: 'Futsal', lat: -6.2, lng: 106.8, radius: 10000, page: 1, limit: 20 };
    await expect(searchPartners(filter, { get } as never)).resolves.toMatchObject({
      meta: { total: 1 },
    });
    expect(get).toHaveBeenCalledWith('/users/search', { params: filter });
  });

  it('formatDistance m/km/id-ID', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(1500)).toBe('1,5 km');
    expect(formatDistance(undefined)).toBe('—');
    expect(formatDistance(null)).toBe('—');
  });

  it('validateSearchPartners menolak lat timpang / radius invalid', () => {
    expect(validateSearchPartners({ lat: -6.2, lng: 106.8 })).toBeNull();
    expect(validateSearchPartners({})).toBeNull();
    expect(validateSearchPartners({ lat: -6.2 })).toBe(
      'Lat dan Lng harus diisi berpasangan',
    );
    expect(validateSearchPartners({ lat: 120, lng: 106.8 })).toBe(
      'Lat harus angka -90 s/d 90',
    );
    expect(validateSearchPartners({ lat: -6.2, lng: 106.8, radius: 10 })).toBe(
      'Radius harus 100..100000 meter',
    );
  });
});
