import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// Polyfill window and global objects for UI / Storage testing
if (typeof window !== 'undefined') {
  // Mock localStorage
  const localStorageStore: Record<string, string> = {};
  const localStorageMock = {
    getItem: (key: string) => localStorageStore[key] || null,
    setItem: (key: string, value: string) => { localStorageStore[key] = value.toString(); },
    clear: () => {
      for (const key in localStorageStore) {
        delete localStorageStore[key];
      }
    },
    removeItem: (key: string) => { delete localStorageStore[key]; },
    length: 0,
    key: (index: number) => Object.keys(localStorageStore)[index] || null,
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

  // Mock navigator.onLine getter/setter
  let online = true;
  Object.defineProperty(navigator, 'onLine', {
    get: () => online,
    configurable: true
  });
  
  // Custom setter helper for tests to toggle network state
  (globalThis as any).setOnline = (state: boolean) => {
    online = state;
    if (state) {
      window.dispatchEvent(new Event('online'));
    } else {
      window.dispatchEvent(new Event('offline'));
    }
  };
}
