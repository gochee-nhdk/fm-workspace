import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SecurityState {
  isLockEnabled: boolean;
  pinHash: string | null;
  isLocked: boolean;
  autoLockMinutes: number; // 0 = never, 5, 15, 30
  lastActiveTimestamp: number;
  
  // Actions
  setPin: (pin: string) => Promise<void>;
  disableLock: (currentPin: string) => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  lockNow: () => void;
  unlock: (pin: string) => Promise<boolean>;
  setAutoLockMinutes: (minutes: number) => void;
  recordActivity: () => void;
  checkAutoLock: () => void;
}

// Per-device unique salt — generated once, stored independently from PIN hash
// This ensures rainbow table attacks against the stored hash are infeasible
const DEVICE_SALT_KEY = 'fm_device_salt_v1';

function getOrCreateDeviceSalt(): string {
  let salt = localStorage.getItem(DEVICE_SALT_KEY);
  if (!salt) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    salt = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_SALT_KEY, salt);
  }
  return salt;
}

// Compute SHA-256 hash using Web Crypto API with per-device salt
async function sha256(message: string): Promise<string> {
  const deviceSalt = getOrCreateDeviceSalt();
  const msgBuffer = new TextEncoder().encode(message + '::FM_WORKSPACE::' + deviceSalt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set, get) => ({
      isLockEnabled: false,
      pinHash: null,
      isLocked: false,
      autoLockMinutes: 0,
      lastActiveTimestamp: Date.now(),

      setPin: async (pin: string) => {
        const hash = await sha256(pin);
        set({
          isLockEnabled: true,
          pinHash: hash,
          isLocked: false,
          lastActiveTimestamp: Date.now(),
        });
      },

      disableLock: async (currentPin: string) => {
        const hash = await sha256(currentPin);
        if (hash === get().pinHash) {
          set({
            isLockEnabled: false,
            pinHash: null,
            isLocked: false,
          });
          return true;
        }
        return false;
      },

      verifyPin: async (pin: string) => {
        const hash = await sha256(pin);
        return hash === get().pinHash;
      },

      lockNow: () => {
        if (get().isLockEnabled) {
          set({ isLocked: true });
        }
      },

      unlock: async (pin: string) => {
        const valid = await get().verifyPin(pin);
        if (valid) {
          set({ isLocked: false, lastActiveTimestamp: Date.now() });
          return true;
        }
        return false;
      },

      setAutoLockMinutes: (minutes: number) => {
        set({ autoLockMinutes: minutes });
      },

      recordActivity: () => {
        const now = Date.now();
        // Throttle updates: only write to store if >30 seconds have elapsed since last recorded activity
        if (now - get().lastActiveTimestamp > 30_000) {
          set({ lastActiveTimestamp: now });
        }
      },

      checkAutoLock: () => {
        const state = get();
        if (!state.isLockEnabled || state.isLocked || state.autoLockMinutes <= 0) {
          return;
        }
        const elapsedMinutes = (Date.now() - state.lastActiveTimestamp) / (1000 * 60);
        if (elapsedMinutes >= state.autoLockMinutes) {
          set({ isLocked: true });
        }
      },
    }),
    {
      name: 'fm_local_security_v1',
      partialize: (state) => ({
        isLockEnabled: state.isLockEnabled,
        pinHash: state.pinHash,
        isLocked: state.isLocked,
        autoLockMinutes: state.autoLockMinutes,
      }),
    }
  )
);
