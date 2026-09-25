import { createBooking } from '../src/api/bookings';
import {
  RentalItem,
  getVenueRentals,
  rentalsTotal,
  validateRentalSelection,
} from '../src/api/venues';
import { facilityLabel } from '../src/screens/VenueDetailScreen';

const catalog: RentalItem[] = [
  { id: 'r1', venueId: 'v1', name: 'Bola futsal', price: 20000, stock: 5, unit: 'pcs', status: 'active' },
  { id: 'r2', venueId: 'v1', name: 'Sepatu', price: 15000, stock: 1, unit: 'pasang', status: 'active' },
  { id: 'r3', venueId: 'v1', name: 'Rompi lama', price: 5000, stock: 0, unit: null, status: 'inactive' },
];

describe('rentals api (ST-10)', () => {
  it('getVenueRentals GET /venues/:id/rentals', async () => {
    const get = jest.fn().mockResolvedValue({ data: { data: catalog, meta: { total: 3 } } });
    await expect(getVenueRentals('v1', { get } as never)).resolves.toEqual(catalog);
    expect(get).toHaveBeenCalledWith('/venues/v1/rentals');
  });

  it('createBooking meneruskan rentals ke POST /bookings', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'b1', status: 'pending' } });
    const input = {
      courtId: 'c1',
      date: '2030-07-20',
      start: '08:00',
      rentals: [{ rentalId: 'r1', qty: 2 }],
    };
    await expect(createBooking(input, { post } as never)).resolves.toMatchObject({ id: 'b1' });
    expect(post).toHaveBeenCalledWith('/bookings', input);
  });

  it('rentalsTotal sum(price*qty)', () => {
    expect(rentalsTotal(catalog, [])).toBe(0);
    expect(
      rentalsTotal(catalog, [
        { rentalId: 'r1', qty: 2 },
        { rentalId: 'r2', qty: 1 },
      ]),
    ).toBe(55000);
    // Id tak dikenal diabaikan (0) — server yang menolak.
    expect(rentalsTotal(catalog, [{ rentalId: 'x', qty: 3 }])).toBe(0);
  });

  it('validateRentalSelection menolak qty absurd/stok kurang/inactive', () => {
    expect(validateRentalSelection(catalog, [])).toBeNull();
    expect(
      validateRentalSelection(catalog, [{ rentalId: 'r1', qty: 2 }]),
    ).toBeNull();
    expect(
      validateRentalSelection(catalog, [{ rentalId: 'r2', qty: 2 }]),
    ).toBe('Stok Sepatu tersisa 1');
    expect(
      validateRentalSelection(catalog, [{ rentalId: 'r3', qty: 1 }]),
    ).toBe('Rompi lama sedang tidak tersedia');
    expect(
      validateRentalSelection(catalog, [{ rentalId: 'r1', qty: 0 }]),
    ).toBe('Jumlah Bola futsal minimal 1');
    expect(
      validateRentalSelection(catalog, [{ rentalId: 'nope', qty: 1 }]),
    ).toBe('Item sewa tidak dikenal');
  });
});

describe('facilities (ST-10)', () => {
  it('facilityLabel kapitalisasi', () => {
    expect(facilityLabel('mushola')).toBe('Mushola');
    expect(facilityLabel('')).toBe('');
  });
});
