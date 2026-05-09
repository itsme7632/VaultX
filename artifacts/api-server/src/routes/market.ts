import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CRYPTO_DATA = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: 68432.5,
    change24h: 1243.2,
    changePercent24h: 1.85,
    marketCap: 1342000000000,
    volume24h: 28700000000,
    iconUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=040",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    price: 3521.8,
    change24h: -45.6,
    changePercent24h: -1.28,
    marketCap: 423000000000,
    volume24h: 14200000000,
    iconUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=040",
  },
  {
    symbol: "BNB",
    name: "BNB",
    price: 412.3,
    change24h: 8.9,
    changePercent24h: 2.2,
    marketCap: 63000000000,
    volume24h: 1500000000,
    iconUrl: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=040",
  },
  {
    symbol: "SOL",
    name: "Solana",
    price: 178.9,
    change24h: 5.2,
    changePercent24h: 3.0,
    marketCap: 82000000000,
    volume24h: 4100000000,
    iconUrl: "https://cryptologos.cc/logos/solana-sol-logo.svg?v=040",
  },
  {
    symbol: "USDT",
    name: "Tether",
    price: 1.0,
    change24h: 0.001,
    changePercent24h: 0.1,
    marketCap: 113000000000,
    volume24h: 67000000000,
    iconUrl: "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040",
  },
  {
    symbol: "XRP",
    name: "XRP",
    price: 0.623,
    change24h: -0.015,
    changePercent24h: -2.35,
    marketCap: 35000000000,
    volume24h: 1200000000,
    iconUrl: "https://cryptologos.cc/logos/xrp-xrp-logo.svg?v=040",
  },
  {
    symbol: "ADA",
    name: "Cardano",
    price: 0.487,
    change24h: 0.021,
    changePercent24h: 4.5,
    marketCap: 17000000000,
    volume24h: 450000000,
    iconUrl: "https://cryptologos.cc/logos/cardano-ada-logo.svg?v=040",
  },
  {
    symbol: "AVAX",
    name: "Avalanche",
    price: 38.7,
    change24h: 1.2,
    changePercent24h: 3.2,
    marketCap: 16000000000,
    volume24h: 620000000,
    iconUrl: "https://cryptologos.cc/logos/avalanche-avax-logo.svg?v=040",
  },
];

router.get("/market/prices", async (_req, res): Promise<void> => {
  const noise = () => (Math.random() - 0.5) * 0.01;
  const data = CRYPTO_DATA.map((coin) => ({
    ...coin,
    price: parseFloat((coin.price * (1 + noise())).toFixed(4)),
    changePercent24h: parseFloat((coin.changePercent24h + (Math.random() - 0.5) * 0.2).toFixed(2)),
  }));
  res.json(data);
});

export default router;
