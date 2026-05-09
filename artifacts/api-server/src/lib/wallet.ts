import { db, walletsTable, walletAddressesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const NETWORKS = ["Bitcoin (BTC)", "Ethereum (ERC20)", "USDT (TRC20)", "BNB (BSC)"];

const DEPOSIT_ADDRESSES: Record<string, string> = {
  "Bitcoin (BTC)": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "Ethereum (ERC20)": "0x742d35Cc6634C0532925a3b8D4C9F7f4b62Ee8E",
  "USDT (TRC20)": "TN3W4H6rK2ce4vX9YnFQHwKx7X8rHBdFW",
  "BNB (BSC)": "0x742d35Cc6634C0532925a3b8D4C9F7f4b62Ee8E",
};

export async function ensureWallet(userId: number): Promise<void> {
  const existing = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(walletsTable).values({ userId });

    const addressRows = NETWORKS.map((network) => ({
      userId,
      network,
      address: DEPOSIT_ADDRESSES[network] ?? "address-placeholder",
    }));
    await db.insert(walletAddressesTable).values(addressRows);
  }
}
