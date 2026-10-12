/**
 * Browser bundle: DeskClient + wallet adapters + Devnet deployment.
 * Prepare + send run in-page against OnFinality Devnet RPC (no Node /api).
 */
import { Buffer } from "buffer";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";

if (!globalThis.Buffer) globalThis.Buffer = Buffer;

// Stub Node builtins before requiring chain (esbuild aliases also apply).
const math = require("./src/math");
const layout = require("./src/layout");
const {
  DeskClient,
  eventsFromLogs,
  hasSessionReject,
  isRateLimit,
  withBackoff,
  TOKEN_PROGRAM_ID,
  IX,
} = require("./src/chain");

const DEPLOYMENT = {
  rpc: "https://solana-devnet.api.onfinality.io/public",
  programId: "E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b",
  desk: "7z22VzGm4uFncPvY2DKHKYbUESEhb6bP8AfoRt3k3WPP",
  dusdMint: "4Ar1dho99UN8HXh5WQEgfVFwikE2kdQL8kGtFq6mFjpJ",
  scarMint: "3ULF37kFcSqYYtJcRSqnFLixwz1bju7BWd2NPqzNYbGs",
  vault: "6kCbzQRB8qyhPnctrKjpWZmn2CmtvbC4WKbPRUocKLRP",
  treasury: "BNRKAuPgosZpfq78ULf2NMtxsbo5dEU4y6iK6DhNL64L",
  oracle: "GvgnPF5Dh5ZcSMWwgTyUrBDdJ8BsTBpu9oM5TzkMXfhG",
  admin: "FvrGAbpFVJXdhfzE3NFNbimKNag7vFubykBvMKUKh89U",
  network: "devnet",
  genesis: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  explorerCluster: "devnet",
  maxLeverage: 1001,
  faucetNote:
    "Permissionless demo faucet (IX 17): wallet signs, mints 1000 dUSD, 60s cooldown. Fee SOL still from https://faucet.solana.com.",
};

const BURNER_KEY = "scardesk-burner";

function isMobileUa() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(root.navigator?.userAgent || "");
}
function openWalletBrowse(kind) {
  const href = root.location?.href || "";
  const enc = encodeURIComponent(href);
  const ref = encodeURIComponent(root.location?.origin || href);
  if (kind === "phantom") {
    root.location.href = "https://phantom.app/ul/browse/" + enc + "?ref=" + ref;
    return;
  }
  if (kind === "solflare") {
    root.location.href = "https://solflare.com/ul/v1/browse/" + enc + "?ref=" + ref;
  }
}

const root = typeof window !== "undefined" ? window : globalThis;

class PhantomAdapter {
  constructor() {
    this.connected = false;
    this.publicKey = null;
    this.provider = null;
  }
  get name() { return "Phantom"; }
  providerOrNull() {
    const injected = root.phantom?.solana || root.solana;
    if (injected && injected.isPhantom) return injected;
    return null;
  }
  async connect() {
    const provider = this.providerOrNull();
    if (!provider) {
      if (isMobileUa()) {
        openWalletBrowse("phantom");
        throw new Error("Opening Phantom app… If nothing opens, install Phantom and open this page inside the wallet browser, or use Browser key.");
      }
      throw new Error("Phantom is not installed in this browser. Use Solflare, or Browser key.");
    }
    const res = await provider.connect();
    const key = (res && res.publicKey) || provider.publicKey;
    this.publicKey = new PublicKey(key.toString());
    this.provider = provider;
    this.connected = true;
    return this.publicKey;
  }
  async disconnect() {
    try { await this.provider?.disconnect(); } catch { /* gone */ }
    this.connected = false;
    this.publicKey = null;
  }
  async signTransaction(tx) {
    if (!this.provider) throw new Error("Phantom is not connected");
    return this.provider.signTransaction(tx);
  }
}

class SolflareAdapter {
  constructor() {
    this.connected = false;
    this.publicKey = null;
    this.provider = null;
  }
  get name() { return "Solflare"; }
  async connect() {
    const provider = root.solflare;
    if (!provider || !provider.isSolflare) {
      if (isMobileUa()) {
        openWalletBrowse("solflare");
        throw new Error("Opening Solflare app… If nothing opens, install Solflare and open this page inside the wallet browser, or use Browser key.");
      }
      throw new Error("Solflare is not installed in this browser. Use Phantom, or Browser key.");
    }
    await provider.connect();
    const key = provider.publicKey;
    if (!key) throw new Error("Solflare did not return a public key");
    this.publicKey = new PublicKey(key.toString());
    this.provider = provider;
    this.connected = true;
    return this.publicKey;
  }
  async disconnect() {
    try { await this.provider?.disconnect(); } catch { /* ignore */ }
    this.connected = false;
    this.publicKey = null;
  }
  async signTransaction(tx) {
    if (!this.provider) throw new Error("Solflare is not connected");
    return this.provider.signTransaction(tx);
  }
}

class BurnerAdapter {
  constructor() {
    this.connected = false;
    this.publicKey = null;
    this.kp = null;
  }
  get name() { return "Browser key"; }
  async connect() {
    const saved = root.localStorage?.getItem(BURNER_KEY);
    if (saved) this.kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(saved)));
    else {
      this.kp = Keypair.generate();
      root.localStorage?.setItem(BURNER_KEY, JSON.stringify(Array.from(this.kp.secretKey)));
    }
    this.publicKey = this.kp.publicKey;
    this.connected = true;
    return this.publicKey;
  }
  async disconnect() {
    this.connected = false;
    this.publicKey = null;
  }
  async signTransaction(tx) {
    if (!this.kp) throw new Error("browser key is not connected");
    tx.partialSign(this.kp);
    return tx;
  }
}

function createConnection(rpc) {
  return new Connection(rpc || DEPLOYMENT.rpc, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });
}

function createClient(connection) {
  return new DeskClient(connection, new PublicKey(DEPLOYMENT.programId));
}

function explorerTx(sig) {
  return "https://explorer.solana.com/tx/" + sig + "?cluster=" + DEPLOYMENT.explorerCluster;
}

function explorerAddr(pk) {
  return "https://explorer.solana.com/address/" + pk + "?cluster=" + DEPLOYMENT.explorerCluster;
}

root.Scardesk = {
  DEPLOYMENT,
  math,
  layout,
  DeskClient,
  eventsFromLogs,
  hasSessionReject,
  isRateLimit,
  withBackoff,
  TOKEN_PROGRAM_ID,
  IX,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  createConnection,
  createClient,
  explorerTx,
  explorerAddr,
  wallet: {
    phantom: () => new PhantomAdapter(),
    solflare: () => new SolflareAdapter(),
    burner: () => new BurnerAdapter(),
  },
  Buffer,
  bytesFromBase64(b64) {
    return Buffer.from(b64, "base64");
  },
  toBase64(bytes) {
    return Buffer.from(bytes).toString("base64");
  },
};

// Back-compat with desk wallet.js shape used by local app.js
root.ScardeskWallet = {
  phantom: () => new PhantomAdapter(),
  solflare: () => new SolflareAdapter(),
  burner: () => new BurnerAdapter(),
  Keypair,
  PublicKey,
  Transaction,
  bytesFromBase64(b64) {
    return Buffer.from(b64, "base64");
  },
  toBase64(bytes) {
    return Buffer.from(bytes).toString("base64");
  },
};
