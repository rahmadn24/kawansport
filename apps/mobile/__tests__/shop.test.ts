import {
  checkoutCart,
  clearCart,
  getCart,
  getOrderDetail,
  listMyOrders,
  setCartItem,
  shopOrderStatusLabel,
  validateCartQty,
} from '../src/api/shop';

describe('shop api (MP-02)', () => {
  it('getCart GET /cart', async () => {
    const get = jest.fn().mockResolvedValue({ data: { items: [], total: 0, count: 0 } });
    await expect(getCart({ get } as never)).resolves.toMatchObject({ total: 0 });
    expect(get).toHaveBeenCalledWith('/cart');
  });

  it('setCartItem PUT /cart { productId, qty }', async () => {
    const put = jest.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    await expect(setCartItem('p1', 2, { put } as never)).resolves.toMatchObject({ total: 0 });
    expect(put).toHaveBeenCalledWith('/cart', { productId: 'p1', qty: 2 });
  });

  it('clearCart PUT /cart { clear: true }', async () => {
    const put = jest.fn().mockResolvedValue({ data: { items: [] } });
    await clearCart({ put } as never);
    expect(put).toHaveBeenCalledWith('/cart', { clear: true });
  });

  it('checkoutCart POST /checkout', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'o1', status: 'pending' } });
    await expect(checkoutCart({ post } as never)).resolves.toMatchObject({ status: 'pending' });
    expect(post).toHaveBeenCalledWith('/checkout', {});
  });

  it('listMyOrders GET /orders/me', async () => {
    const get = jest.fn().mockResolvedValue({ data: { data: [{ id: 'o1' }] } });
    await expect(listMyOrders({ get } as never)).resolves.toEqual([{ id: 'o1' }]);
    expect(get).toHaveBeenCalledWith('/orders/me');
  });

  it('getOrderDetail GET /orders/:id', async () => {
    const get = jest.fn().mockResolvedValue({ data: { id: 'o1' } });
    await expect(getOrderDetail('o1', { get } as never)).resolves.toMatchObject({ id: 'o1' });
    expect(get).toHaveBeenCalledWith('/orders/o1');
  });

  it('shopOrderStatusLabel + validateCartQty', async () => {
    expect(shopOrderStatusLabel('pending')).toBe('Menunggu bayar');
    expect(shopOrderStatusLabel('paid')).toBe('Lunas');
    expect(shopOrderStatusLabel('expired')).toBe('Kedaluwarsa');
    expect(shopOrderStatusLabel('cancelled')).toBe('Dibatalkan');
    expect(validateCartQty(2)).toBeNull();
    expect(validateCartQty(0)).toBeNull();
    expect(validateCartQty(-1)).not.toBeNull();
    expect(validateCartQty(1.5)).not.toBeNull();
  });
});
