import {
  bookEventCourt,
  bookingStatusLabel,
  cancelBooking,
  checkInBooking,
  createBooking,
  eventDayKey,
  formatDateShort,
  formatIDR,
  formatSlotLabel,
  getBookingDetail,
  listMyBookings,
  lookupBookingByCode,
  next14Days,
  toDateKey,
  validateBookingInput,
} from '../src/api/bookings';
import {
  activeCourts,
  getCourtAvailability,
  getVenueDetail,
  isBookable,
  listVenues,
  validateAvailabilityDate,
} from '../src/api/venues';
import {
  formatPoints,
  getLoyaltyBalance,
  normalizeVoucherCode,
  validateVoucherCode,
} from '../src/api/vouchers';

describe('bookings api (BK-04)', () => {
  it('createBooking POST /bookings', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'b1', status: 'pending' } });
    const input = { courtId: 'c1', date: '2030-06-17', start: '09:00' };
    await expect(createBooking(input, { post } as never)).resolves.toMatchObject({
      status: 'pending',
    });
    expect(post).toHaveBeenCalledWith('/bookings', input);
  });

  it('bookEventCourt POST /events/:id/book', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'b2', eventId: 'e1' } });
    const input = { courtId: 'c1', date: '2030-06-17', start: '09:00' };
    await expect(bookEventCourt('e1', input, { post } as never)).resolves.toMatchObject({
      eventId: 'e1',
    });
    expect(post).toHaveBeenCalledWith('/events/e1/book', input);
  });

  it('listMyBookings GET /bookings/me', async () => {
    const get = jest.fn().mockResolvedValue({ data: { data: [{ id: 'b1' }] } });
    await expect(listMyBookings({ get } as never)).resolves.toEqual([{ id: 'b1' }]);
    expect(get).toHaveBeenCalledWith('/bookings/me');
  });

  it('getBookingDetail GET /bookings/:id', async () => {
    const get = jest.fn().mockResolvedValue({ data: { id: 'b1' } });
    await expect(getBookingDetail('b1', { get } as never)).resolves.toMatchObject({ id: 'b1' });
    expect(get).toHaveBeenCalledWith('/bookings/b1');
  });

  it('cancelBooking POST /bookings/:id/cancel', async () => {
    const post = jest.fn().mockResolvedValue({ data: { ok: true, status: 'cancelled' } });
    await expect(cancelBooking('b1', { post } as never)).resolves.toMatchObject({
      status: 'cancelled',
    });
    expect(post).toHaveBeenCalledWith('/bookings/b1/cancel', {});
  });

  it('lookupBookingByCode GET /bookings/by-code/:code (API-W07)', async () => {
    const get = jest.fn().mockResolvedValue({ data: { id: 'b1', code: 'KS-ABCDEF' } });
    await expect(lookupBookingByCode('ks-abcdef', { get } as never)).resolves.toMatchObject({
      code: 'KS-ABCDEF',
    });
    expect(get).toHaveBeenCalledWith('/bookings/by-code/ks-abcdef');
  });

  it('checkInBooking POST /bookings/:id/check-in (API-W07)', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'b1', checkedInAt: '2030-06-17T09:00:00Z' } });
    await expect(checkInBooking('b1', { post } as never)).resolves.toMatchObject({
      id: 'b1',
    });
    expect(post).toHaveBeenCalledWith('/bookings/b1/check-in', {});
  });
});

describe('venues api (BK-04)', () => {
  it('listVenues GET /venues dengan params filter', async () => {
    const get = jest
      .fn()
      .mockResolvedValue({ data: { data: [], meta: { page: 1, limit: 20, total: 0 } } });
    await expect(listVenues({ sport: 'Futsal' }, { get } as never)).resolves.toMatchObject({ data: [] });
    expect(get).toHaveBeenCalledWith('/venues', { params: { sport: 'Futsal' } });
  });

  it('getVenueDetail GET /venues/:id', async () => {
    const get = jest.fn().mockResolvedValue({ data: { id: 'v1', courts: [] } });
    await expect(getVenueDetail('v1', { get } as never)).resolves.toMatchObject({ id: 'v1' });
    expect(get).toHaveBeenCalledWith('/venues/v1');
  });

  it('getCourtAvailability GET /courts/:id/availability?date=', async () => {
    const get = jest.fn().mockResolvedValue({ data: { courtId: 'c1', slots: [] } });
    await expect(
      getCourtAvailability('c1', '2030-06-17', { get } as never),
    ).resolves.toMatchObject({ courtId: 'c1' });
    expect(get).toHaveBeenCalledWith('/courts/c1/availability', {
      params: { date: '2030-06-17' },
    });
  });

  it('activeCourts hanya yang active', () => {
    const venue = {
      courts: [
        { id: 'a', status: 'active' },
        { id: 'b', status: 'inactive' },
      ],
    } as never;
    expect(activeCourts(venue).map((c) => c.id)).toEqual(['a']);
  });

  it('isBookable hanya free (blocked ditutup owner, API-W06)', () => {
    expect(isBookable({ status: 'free' })).toBe(true);
    expect(isBookable({ status: 'held' })).toBe(false);
    expect(isBookable({ status: 'booked' })).toBe(false);
    expect(isBookable({ status: 'blocked' })).toBe(false);
  });

  it('validateAvailabilityDate menolak format/kalender invalid', () => {
    expect(validateAvailabilityDate('2030-06-17')).toBeNull();
    expect(validateAvailabilityDate('17-06-2030')).toBe('Tanggal harus format YYYY-MM-DD');
    expect(validateAvailabilityDate('2030-02-30')).toBe('Tanggal tidak valid');
  });
});

describe('booking helpers/format (BK-04)', () => {
  it('bookingStatusLabel Bahasa Indonesia', () => {
    expect(bookingStatusLabel('pending')).toBe('Menunggu bayar');
    expect(bookingStatusLabel('paid')).toBe('Lunas');
    expect(bookingStatusLabel('expired')).toBe('Kedaluwarsa');
    expect(bookingStatusLabel('cancelled')).toBe('Dibatalkan');
  });

  it('formatIDR rupiah', () => {
    expect(formatIDR(120000)).toBe('Rp120.000');
    expect(formatIDR(100000)).toBe('Rp100.000');
  });

  it('formatDateShort + formatSlotLabel', () => {
    expect(formatDateShort('2030-06-17')).toBe('17 Jun 2030');
    expect(formatDateShort('asal')).toBe('asal');
    expect(formatSlotLabel('2030-06-17', '09:00', '10:00')).toBe('17 Jun 2030 • 09:00–10:00');
  });

  it('toDateKey YYYY-MM-DD waktu lokal', () => {
    expect(toDateKey(new Date(2030, 5, 17, 12, 0, 0))).toBe('2030-06-17');
  });

  it('eventDayKey hari-UTC (selaras aturan server)', () => {
    expect(eventDayKey('2030-06-17T09:00:00Z')).toBe('2030-06-17');
    expect(eventDayKey('2030-06-17T09:00:00+07:00')).toBe('2030-06-17');
  });

  it('next14Days 14 kunci berurutan mulai hari ini', () => {
    const days = next14Days(new Date(2030, 5, 17, 12, 0, 0));
    expect(days).toHaveLength(14);
    expect(days[0]).toBe('2030-06-17');
    expect(days[13]).toBe('2030-06-30');
  });

  it('validateBookingInput menolak input invalid', () => {
    expect(
      validateBookingInput({ courtId: 'c1', date: '2030-06-17', start: '09:00' }),
    ).toBeNull();
    expect(validateBookingInput({ courtId: '', date: '2030-06-17', start: '09:00' })).toBe(
      'Court wajib dipilih',
    );
    expect(validateBookingInput({ courtId: 'c1', date: '17/06/2030', start: '09:00' })).toBe(
      'Tanggal harus format YYYY-MM-DD',
    );
    expect(validateBookingInput({ courtId: 'c1', date: '2030-06-17' })).toBe(
      'Jam mulai wajib dipilih',
    );
    expect(validateBookingInput({ courtId: 'c1', date: '2030-06-17', start: '25:00' })).toBe(
      'Jam mulai tidak valid (HH:MM)',
    );
  });
});

describe('voucher + poin (ST-04)', () => {
  it('normalizeVoucherCode uppercase + trim', () => {
    expect(normalizeVoucherCode(' hemat10 ')).toBe('HEMAT10');
  });

  it('validateVoucherCode menolak format invalid', () => {
    expect(validateVoucherCode('HEMAT10')).toBeNull();
    expect(validateVoucherCode('  ')).toBe('Kode voucher wajib diisi');
    expect(validateVoucherCode('ab')).toBe('Kode voucher 3–32 karakter (huruf/angka/-/_)');
  });

  it('getLoyaltyBalance GET /me -> loyaltyPoints', async () => {
    const get = jest.fn().mockResolvedValue({ data: { loyaltyPoints: 150 } });
    await expect(getLoyaltyBalance({ get } as never)).resolves.toBe(150);
    expect(get).toHaveBeenCalledWith('/me');
  });

  it('formatPoints 1 poin = Rp1', () => {
    expect(formatPoints(1500)).toBe('1.500 poin (= Rp1.500)');
  });
});
