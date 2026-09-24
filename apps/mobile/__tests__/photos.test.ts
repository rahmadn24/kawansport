import {
  firstPhoto,
  isAllowedPhotoUrl,
  resolvePhotoUrl,
  sanitizePhotos,
} from '../src/api/photos';

describe('photos ST-01 (validasi URL aman)', () => {
  it('terima path /uploads/... dan https', () => {
    expect(isAllowedPhotoUrl('/uploads/images/a.jpg')).toBe(true);
    expect(isAllowedPhotoUrl('https://cdn.example.com/a.jpg')).toBe(true);
  });

  it('tolak skema aneh', () => {
    expect(isAllowedPhotoUrl('http://evil.com/a.jpg')).toBe(false);
    expect(isAllowedPhotoUrl('data:image/png;base64,xx')).toBe(false);
    expect(isAllowedPhotoUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedPhotoUrl('/uploads/../secret.txt')).toBe(false);
    expect(isAllowedPhotoUrl('/uploads/a b.jpg')).toBe(false);
    expect(isAllowedPhotoUrl('')).toBe(false);
    expect(isAllowedPhotoUrl(null)).toBe(false);
    expect(isAllowedPhotoUrl('/uploads/')).toBe(false);
  });

  it('sanitizePhotos buang yang tak aman, jaga urutan', () => {
    expect(
      sanitizePhotos([
        'https://cdn.example.com/a.jpg',
        'http://evil.com/b.jpg',
        '/uploads/images/c.jpg',
        '',
        null,
      ]),
    ).toEqual(['https://cdn.example.com/a.jpg', '/uploads/images/c.jpg']);
    expect(sanitizePhotos(null)).toEqual([]);
    expect(sanitizePhotos(undefined)).toEqual([]);
  });

  it('resolvePhotoUrl gabung base untuk path relatif', () => {
    expect(resolvePhotoUrl('/uploads/images/a.jpg', 'http://10.0.2.2:3000')).toBe(
      'http://10.0.2.2:3000/uploads/images/a.jpg',
    );
    expect(resolvePhotoUrl('/uploads/images/a.jpg', 'http://x:3000/')).toBe(
      'http://x:3000/uploads/images/a.jpg',
    );
    expect(resolvePhotoUrl('https://cdn.example.com/a.jpg')).toBe(
      'https://cdn.example.com/a.jpg',
    );
    expect(resolvePhotoUrl('http://evil.com/a.jpg')).toBe('');
  });

  it('firstPhoto null bila kosong', () => {
    expect(firstPhoto(['/uploads/images/a.jpg'])).toBe('/uploads/images/a.jpg');
    expect(firstPhoto([])).toBeNull();
    expect(firstPhoto(['http://evil.com/a.jpg'])).toBeNull();
  });
});
