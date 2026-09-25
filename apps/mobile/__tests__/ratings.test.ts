import {
  ANONYMOUS_DISPLAY_NAME,
  MAX_REVIEW_TAGS,
  REVIEW_ASPECT_KEYS,
  REVIEW_ASPECT_LABELS,
  REVIEW_TAG_PRESETS,
  createRating,
  getRatingDetail,
  isValidAspectsClient,
  normalizeTagsClient,
  updateRating,
  type RatingItem,
} from '../src/api/ratings';

describe('ratings ST-06 (aspek, tag, anonim)', () => {
  it('konstanta aspek: 4 kunci + label Indonesia', () => {
    expect(REVIEW_ASPECT_KEYS).toEqual(['lapangan', 'cahaya', 'bersih', 'staf']);
    expect(REVIEW_ASPECT_LABELS.lapangan).toBe('Lapangan');
    expect(REVIEW_ASPECT_LABELS.cahaya).toBe('Cahaya');
    expect(REVIEW_ASPECT_LABELS.bersih).toBe('Kebersihan');
    expect(REVIEW_ASPECT_LABELS.staf).toBe('Staf');
    expect(ANONYMOUS_DISPLAY_NAME).toBe('Anonim');
    expect(MAX_REVIEW_TAGS).toBe(5);
    expect(REVIEW_TAG_PRESETS.length).toBeGreaterThan(0);
  });

  it('normalizeTagsClient: lowercase-trim + dedupe + cap 5', () => {
    expect(normalizeTagsClient([' Bersih ', 'BERSIH', 'Murah'])).toEqual([
      'bersih',
      'murah',
    ]);
    expect(normalizeTagsClient(['', '  ', null, undefined])).toEqual([]);
    expect(
      normalizeTagsClient(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
    ).toEqual(['a', 'b', 'c', 'd', 'e']);
    // Jaga urutan kemunculan pertama.
    expect(normalizeTagsClient(['b', 'a', 'b'])).toEqual(['b', 'a']);
  });

  it('isValidAspectsClient: parsial OK, di luar 1..5 atau kunci asing KO', () => {
    expect(isValidAspectsClient(undefined)).toBe(true);
    expect(isValidAspectsClient(null)).toBe(true);
    expect(isValidAspectsClient({})).toBe(true);
    expect(isValidAspectsClient({ lapangan: 5, bersih: 1 })).toBe(true);
    expect(isValidAspectsClient({ cahaya: 0 })).toBe(false);
    expect(isValidAspectsClient({ staf: 6 })).toBe(false);
    expect(isValidAspectsClient({ staf: 2.5 })).toBe(false);
    expect(isValidAspectsClient({ parkir: 5 } as never)).toBe(false);
  });

  it('createRating meneruskan aspects/tags/isAnonymous ke POST /ratings', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'r1' } });
    await createRating(
      {
        venueId: 'v1',
        score: 4,
        aspects: { lapangan: 5 },
        tags: ['bersih'],
        isAnonymous: true,
      },
      { get: jest.fn(), post, put: jest.fn(), delete: jest.fn() },
    );
    expect(post).toHaveBeenCalledWith('/ratings', {
      venueId: 'v1',
      score: 4,
      aspects: { lapangan: 5 },
      tags: ['bersih'],
      isAnonymous: true,
    });
  });

  it('updateRating meneruskan aspek null (hapus) + tags + anonim', async () => {
    const put = jest.fn().mockResolvedValue({ data: { id: 'r1' } });
    await updateRating(
      'r1',
      { aspects: null, tags: [], isAnonymous: false },
      { get: jest.fn(), post: jest.fn(), put, delete: jest.fn() },
    );
    expect(put).toHaveBeenCalledWith('/ratings/r1', {
      aspects: null,
      tags: [],
      isAnonymous: false,
    });
  });

  it('getRatingDetail memetakan field ST-06 apa adanya (backward-compat)', async () => {
    const legacy = { id: 'r1', review: { id: 'w1', comment: 'ok' } };
    const get = jest.fn().mockResolvedValue({ data: legacy });
    const res = await getRatingDetail('r1', {
      get,
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    });
    expect((res as RatingItem).review).toMatchObject({ comment: 'ok' });
    expect((res as RatingItem).review?.aspects).toBeUndefined();
  });
});
