export const defaultWalletBalance = 100000;

const walletStorageKey = "hasik:wallet-balance";
const walletResetStorageKey = "hasik:wallet-reset-at";

export interface WalletState {
  balance: number;
  resetAt: number;
}

export function getWalletResetAt(value = Date.now()) {
  const resetAt = new Date(value);
  resetAt.setHours(18, 0, 0, 0);

  if (value < resetAt.getTime()) {
    resetAt.setDate(resetAt.getDate() - 1);
  }

  return resetAt.getTime();
}

export function getSavedWalletState(value = Date.now()): WalletState {
  const resetAt = getWalletResetAt(value);

  if (typeof window === "undefined") {
    return { balance: defaultWalletBalance, resetAt };
  }

  try {
    const savedResetAt = Number(localStorage.getItem(walletResetStorageKey));

    if (savedResetAt !== resetAt) {
      localStorage.setItem(walletStorageKey, String(defaultWalletBalance));
      localStorage.setItem(walletResetStorageKey, String(resetAt));
      return { balance: defaultWalletBalance, resetAt };
    }

    const savedBalance = Number(localStorage.getItem(walletStorageKey));

    if (Number.isFinite(savedBalance) && savedBalance >= 0) {
      return { balance: Math.floor(savedBalance), resetAt };
    }
  } catch {
    return { balance: defaultWalletBalance, resetAt };
  }

  return { balance: defaultWalletBalance, resetAt };
}

export function saveWalletState(balance: number, resetAt = getWalletResetAt()) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(walletStorageKey, String(Math.max(0, Math.floor(balance))));
    localStorage.setItem(walletResetStorageKey, String(resetAt));
  } catch {
    return;
  }
}
