import {
  __forceMemoryFallback,
  clearTokens,
  getTokens,
  setAccessToken,
  setTokens,
} from '../src/api/tokenStorage';

describe('tokenStorage (SM-02)', () => {
  beforeEach(async () => {
    __forceMemoryFallback();
    await clearTokens();
  });

  it('set/get roundtrip menyimpan token pair', async () => {
    await setTokens({ accessToken: 'a1', refreshToken: 'r1' });
    await expect(getTokens()).resolves.toEqual({ accessToken: 'a1', refreshToken: 'r1' });
  });

  it('setAccessToken hanya mengganti access token', async () => {
    await setTokens({ accessToken: 'a1', refreshToken: 'r1' });
    await setAccessToken('a2');
    await expect(getTokens()).resolves.toEqual({ accessToken: 'a2', refreshToken: 'r1' });
  });

  it('clearTokens mengosongkan keduanya', async () => {
    await setTokens({ accessToken: 'a1', refreshToken: 'r1' });
    await clearTokens();
    await expect(getTokens()).resolves.toEqual({ accessToken: null, refreshToken: null });
  });

  it('setTokens menolak pair tak lengkap', async () => {
    await expect(
      setTokens({ accessToken: null, refreshToken: 'r1' }),
    ).rejects.toThrow();
  });
});
