import { fetchMe, toggleSport, updateMe, uploadAvatar } from '../src/api/profile';
import { getCurrentPosition } from '../src/location/geolocation';

describe('profile helpers (SM-03)', () => {
  it('toggleSport menambah, menghapus, dan dedupe case-insensitive', () => {
    expect(toggleSport([], 'Futsal')).toEqual(['Futsal']);
    expect(toggleSport(['Futsal'], 'futsal')).toEqual([]);
    expect(toggleSport(['Basket'], 'Futsal')).toEqual(['Basket', 'Futsal']);
    expect(toggleSport(['Basket'], '  ')).toEqual(['Basket']);
  });

  it('fetchMe GET /me', async () => {
    const http = { get: jest.fn().mockResolvedValue({ data: { id: '1' } }) } as never;
    await expect(fetchMe(http)).resolves.toEqual({ id: '1' });
    expect((http as { get: jest.Mock }).get).toHaveBeenCalledWith('/me');
  });

  it('updateMe PATCH /me', async () => {
    const http = {
      patch: jest.fn().mockResolvedValue({ data: { skillLevel: 'advanced' } }),
    } as never;
    const input = { sports: ['Lari'], skillLevel: 'advanced' as const, lat: -6.2, lng: 106.8 };
    await expect(updateMe(input, http)).resolves.toEqual({ skillLevel: 'advanced' });
    expect((http as { patch: jest.Mock }).patch).toHaveBeenCalledWith('/me', input);
  });

  it('uploadAvatar POST multipart /me/avatar dan kembalikan URL', async () => {
    const post = jest.fn().mockResolvedValue({ data: { avatarUrl: '/uploads/avatars/a.png' } });
    const url = await uploadAvatar({ uri: 'file:///a.jpg' }, { post } as never);
    expect(url).toBe('/uploads/avatars/a.png');
    expect(post).toHaveBeenCalledWith(
      '/me/avatar',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );
  });
});

describe('geolocation wrapper (SM-03)', () => {
  const nav = (globalThis as { navigator?: unknown }).navigator;

  afterEach(() => {
    (globalThis as { navigator?: unknown }).navigator = nav;
  });

  it('menolak dengan pesan jelas bila provider tidak ada', async () => {
    (globalThis as { navigator?: unknown }).navigator = undefined;
    await expect(getCurrentPosition(100)).rejects.toThrow('GPS tidak tersedia');
  });

  it('resolve koordinat dari navigator.geolocation', async () => {
    (globalThis as { navigator?: unknown }).navigator = {
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void) =>
          ok({ coords: { latitude: -6.2, longitude: 106.8 } }),
      },
    };
    await expect(getCurrentPosition()).resolves.toEqual({ latitude: -6.2, longitude: 106.8 });
  });

  it('meneruskan error provider', async () => {
    (globalThis as { navigator?: unknown }).navigator = {
      geolocation: {
        getCurrentPosition: (_ok: unknown, err: (e: unknown) => void) =>
          err({ message: 'denied' }),
      },
    };
    await expect(getCurrentPosition()).rejects.toThrow('denied');
  });
});
