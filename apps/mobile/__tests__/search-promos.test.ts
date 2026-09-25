import {
  hasLivePromos,
  listPromos,
  type PromoItem,
} from '../src/api/promos';
import {
  searchAll,
  searchKindIcon,
  searchKindLabel,
  validateSearchFilter,
} from '../src/api/search';

const promos: PromoItem[] = [
  {
    id: 'p1',
    title: 'Promo Live',
    imageUrl: 'https://cdn.example.com/live.jpg',
    link: null,
    active: true,
    startsAt: null,
    endsAt: null,
  },
];

describe('search api (ST-09)', () => {
  it('searchAll GET /search dengan filter', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        data: [{ kind: 'venue', id: 'v1', title: 'GOR Mabar', subtitle: 'Jl. Merdeka' }],
        meta: { total: 1, limit: 20 },
      },
    });
    const res = await searchAll({ q: 'mabar', limit: 20 }, { get } as never);
    expect(res.meta.total).toBe(1);
    expect(res.data[0].kind).toBe('venue');
    expect(get).toHaveBeenCalledWith('/search', {
      params: { q: 'mabar', limit: 20 },
    });
  });

  it('validateSearchFilter menolak lat/lng sebelah + radius/limit absurd', () => {
    expect(validateSearchFilter({ q: 'mabar' })).toBeNull();
    expect(validateSearchFilter({})).toBeNull();
    expect(validateSearchFilter({ lat: -6.2 })).toBe(
      'Lat dan lng harus diisi berpasangan',
    );
    expect(validateSearchFilter({ lat: -100, lng: 106 })).toBe(
      'Lat harus angka -90 s/d 90',
    );
    expect(validateSearchFilter({ lat: -6, lng: 200 })).toBe(
      'Lng harus angka -180 s/d 180',
    );
    expect(validateSearchFilter({ radius: 50 })).toBe(
      'Radius harus 100..100000 meter',
    );
    expect(validateSearchFilter({ limit: 99 })).toBe(
      'Limit harus bilangan bulat 1..50',
    );
    expect(validateSearchFilter({ lat: -6.2, lng: 106.8, radius: 5000 })).toBeNull();
  });

  it('label + ikon kind Bahasa Indonesia', () => {
    expect(searchKindLabel('venue')).toBe('Venue');
    expect(searchKindLabel('event')).toBe('Event');
    expect(searchKindLabel('product')).toBe('Produk');
    expect(searchKindIcon('venue')).toBe('🏟');
  });
});

describe('promos api (ST-09)', () => {
  it('listPromos GET /promos -> array banner', async () => {
    const get = jest.fn().mockResolvedValue({
      data: { data: promos, meta: { total: 1 } },
    });
    await expect(listPromos({ get } as never)).resolves.toEqual(promos);
    expect(get).toHaveBeenCalledWith('/promos');
  });

  it('hasLivePromos: kosong/null = sembunyi (bukan placeholder palsu)', () => {
    expect(hasLivePromos(promos)).toBe(true);
    expect(hasLivePromos([])).toBe(false);
    expect(hasLivePromos(null)).toBe(false);
    expect(hasLivePromos(undefined)).toBe(false);
  });
});
