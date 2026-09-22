/**
 * Setup jest mobile (SM-02): mock react-native-encrypted-storage karena
 * native module (Keychain/Keystore) tidak tersedia di lingkungan jest.
 * Mock memakai Map in-memory dengan API yang sama (getItem/setItem/removeItem).
 */
jest.mock('react-native-encrypted-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
      setItem: jest.fn(async (key, value) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key) => {
        store.delete(key);
      }),
      __store: store,
    },
  };
});
