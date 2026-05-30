/**
 * Auto-reset vouchers on app load if version changed
 * Runs automatically on client side, no user action needed
 */

type WalletItem = {
  type: string;
  voucherExpiresAt?: string;
  voucherUsableFrom?: string;
  firstWonAt?: string;
  [key: string]: any;
};

type Wallet = {
  items: WalletItem[];
  updatedAt: string;
};

const APP_VERSION_KEY = "xfc-app-version";
const WALLET_KEY = "xfc-wallet-v2";
const DEPLOYMENT_VERSION =
  process.env.NEXT_PUBLIC_DEPLOYMENT_VERSION || "2026-05-30-v6";

export function initializeAutoReset() {
  if (typeof window === "undefined") return;

  const currentVersion = localStorage.getItem(APP_VERSION_KEY);

  // If version changed or first visit, reset vouchers
  if (currentVersion !== DEPLOYMENT_VERSION) {
    console.log(
      `🔄 Version update detected: ${currentVersion} → ${DEPLOYMENT_VERSION}`,
    );
    resetVouchersInLocalStorage();
    localStorage.setItem(APP_VERSION_KEY, DEPLOYMENT_VERSION);
  }
}

function resetVouchersInLocalStorage() {
  const walletData = localStorage.getItem(WALLET_KEY);

  if (!walletData) {
    console.log("ℹ️  No wallet data to reset");
    return;
  }

  try {
    const wallet: Wallet = JSON.parse(walletData);
    const year = new Date().getFullYear();

    // May 30th to June 15th
    const mayThirtieth = new Date(year, 4, 30, 0, 0, 0).toISOString();
    const juneFifteenth = new Date(year, 5, 15, 23, 59, 59, 999).toISOString();

    let resetCount = 0;

    wallet.items = (wallet.items || []).map((item: WalletItem) => {
      if (item.type === "voucher") {
        item.voucherExpiresAt = juneFifteenth;
        item.voucherUsableFrom = mayThirtieth;
        item.firstWonAt = mayThirtieth;
        resetCount++;
      }
      return item;
    });

    wallet.updatedAt = new Date().toISOString();
    localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));

    console.log(`✅ Auto-reset ${resetCount} vouchers to 30/5 - 15/6`);
  } catch (error) {
    console.error("❌ Auto-reset error:", error);
  }
}
