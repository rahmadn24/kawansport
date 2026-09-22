import {
  createEvent,
  getEventDetail,
  joinEvent,
  leaveEvent,
  listEvents,
  listParticipants,
  slotsLeft,
  validateCreateEvent,
  CreateEventInput,
} from '../src/api/events';

const valid: CreateEventInput = {
  sport: 'Futsal',
  title: 'Sparing Sabtu Pagi',
  description: 'Main santai',
  datetime: '2026-10-03T09:00:00+07:00',
  lat: -6.2,
  lng: 106.8,
  capacity: 10,
};

describe('events api (SM-04)', () => {
  it('createEvent POST /events', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'e1', status: 'open' } });
    await expect(createEvent(valid, { post } as never)).resolves.toEqual({
      id: 'e1',
      status: 'open',
    });
    expect(post).toHaveBeenCalledWith('/events', valid);
  });

  it('listEvents GET /events dengan params filter', async () => {
    const get = jest
      .fn()
      .mockResolvedValue({ data: { data: [], meta: { page: 1, limit: 20, total: 0 } } });
    const filter = { sport: 'Futsal', page: 1, limit: 20 };
    await expect(listEvents(filter, { get } as never)).resolves.toMatchObject({ data: [] });
    expect(get).toHaveBeenCalledWith('/events', { params: filter });
  });

  it('getEventDetail GET /events/:id', async () => {
    const get = jest.fn().mockResolvedValue({ data: { id: 'e1', isJoined: false } });
    await expect(getEventDetail('e1', { get } as never)).resolves.toMatchObject({
      isJoined: false,
    });
    expect(get).toHaveBeenCalledWith('/events/e1');
  });

  it('slotsLeft = capacity - participantsCount (min 0)', () => {
    expect(slotsLeft({ capacity: 10, participantsCount: 1 })).toBe(9);
    expect(slotsLeft({ capacity: 10, participantsCount: 10 })).toBe(0);
  });

  it('validateCreateEvent menolak input invalid', () => {
    expect(validateCreateEvent(valid)).toBeNull();
    expect(validateCreateEvent({ ...valid, sport: '  ' })).toBe('Olahraga wajib diisi');
    expect(validateCreateEvent({ ...valid, title: '' })).toBe('Judul wajib diisi');
    expect(validateCreateEvent({ ...valid, datetime: 'kapan-kapan' })).toBe(
      'Waktu event tidak valid',
    );
    expect(validateCreateEvent({ ...valid, lat: 120 })).toBe('Lat harus angka -90 s/d 90');
    expect(validateCreateEvent({ ...valid, lng: 200 })).toBe('Lng harus angka -180 s/d 180');
    expect(validateCreateEvent({ ...valid, capacity: 1 })).toBe(
      'Kapasitas harus bilangan bulat 2..500',
    );
  });
});

describe('event participants api (SM-05)', () => {
  it('joinEvent POST /events/:id/join', async () => {
    const post = jest
      .fn()
      .mockResolvedValue({ data: { id: 'e1', isJoined: true, participantsCount: 2 } });
    await expect(joinEvent('e1', { post } as never)).resolves.toMatchObject({
      isJoined: true,
    });
    expect(post).toHaveBeenCalledWith('/events/e1/join', {});
  });

  it('leaveEvent POST /events/:id/leave', async () => {
    const post = jest
      .fn()
      .mockResolvedValue({ data: { id: 'e1', isJoined: false, participantsCount: 1 } });
    await expect(leaveEvent('e1', { post } as never)).resolves.toMatchObject({
      isJoined: false,
    });
    expect(post).toHaveBeenCalledWith('/events/e1/leave', {});
  });

  it('listParticipants GET /events/:id/participants', async () => {
    const get = jest.fn().mockResolvedValue({
      data: { data: [{ userId: 'u1', email: 'a@x.com' }], meta: { total: 1 } },
    });
    await expect(listParticipants('e1', { get } as never)).resolves.toMatchObject({
      meta: { total: 1 },
    });
    expect(get).toHaveBeenCalledWith('/events/e1/participants');
  });
});
