/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
import type { AxiosAdapter, AxiosRequestConfig } from 'axios';

describe('api client auto-refresh (SM-02)', () => {
  let tokenStorage: typeof import('../src/api/tokenStorage');
  let clientMod: typeof import('../src/api/client');
  let axiosDefault: any;

  beforeEach(() => {
    jest.resetModules();
    tokenStorage = require('../src/api/tokenStorage');
    tokenStorage.__forceMemoryFallback();
    clientMod = require('../src/api/client');
    const axiosMod = require('axios');
    axiosDefault = axiosMod.default ?? axiosMod;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await tokenStorage.clearTokens();
  });

  it('refreshAccessToken menukar refresh token dan menyimpan pair baru', async () => {
    await tokenStorage.setTokens({ accessToken: 'old-a', refreshToken: 'old-r' });
    const http = {
      post: jest.fn().mockResolvedValue({
        data: { accessToken: 'new-a', refreshToken: 'new-r' },
      }),
    };
    const access = await clientMod.refreshAccessToken(http as any, 'http://test');
    expect(access).toBe('new-a');
    expect(http.post).toHaveBeenCalledWith(
      'http://test/auth/refresh',
      { refreshToken: 'old-r' },
      expect.anything(),
    );
    await expect(tokenStorage.getTokens()).resolves.toEqual({
      accessToken: 'new-a',
      refreshToken: 'new-r',
    });
  });

  it('refreshAccessToken gagal tanpa refresh token tersimpan', async () => {
    await tokenStorage.clearTokens();
    await expect(
      clientMod.refreshAccessToken({ post: jest.fn() } as any, 'http://test'),
    ).rejects.toThrow('No refresh token');
  });

  it('401 memicu refresh sekali lalu retry dengan token baru', async () => {
    await tokenStorage.setTokens({ accessToken: 'old-a', refreshToken: 'old-r' });
    const postSpy = jest.spyOn(axiosDefault, 'post').mockResolvedValue({
      data: { accessToken: 'new-a', refreshToken: 'new-r' },
    });
    const client = clientMod.createApiClient('http://test');
    const seenAuth: Array<string | undefined> = [];
    let calls = 0;
    const adapter: AxiosAdapter = async (config) => {
      calls += 1;
      seenAuth.push((config.headers as any)?.Authorization);
      if (calls === 1) {
        const err: any = new Error('Request failed with status code 401');
        err.config = config;
        err.response = { status: 401 };
        err.isAxiosError = true;
        throw err;
      }
      return {
        data: { email: 'u@e.c' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };
    const res = await client.get(
      '/me',
      { adapter } as unknown as AxiosRequestConfig,
    );
    expect(res.data).toEqual({ email: 'u@e.c' });
    expect(seenAuth).toEqual(['Bearer old-a', 'Bearer new-a']);
    expect(postSpy).toHaveBeenCalledWith(
      'http://test/auth/refresh',
      { refreshToken: 'old-r' },
      expect.anything(),
    );
  });

  it('tanpa token tersimpan, request dikirim tanpa header Authorization', async () => {
    await tokenStorage.clearTokens();
    const client = clientMod.createApiClient('http://test');
    let auth: string | undefined = 'sentinel';
    const adapter: AxiosAdapter = async (config) => {
      auth = (config.headers as any)?.Authorization;
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };
    await client.get('/me', { adapter } as unknown as AxiosRequestConfig);
    expect(auth).toBeUndefined();
  });
});
