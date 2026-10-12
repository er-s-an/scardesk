/**
 * Browser wallet bundle entry. Phantom and Solflare talk to the installed
 * extension. BurnerAdapter implements the same connect / signTransaction
 * shape so a machine without the extension can still submit. It is not Phantom.
 */

import { Buffer } from "buffer";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";

if (!globalThis.Buffer) globalThis.Buffer = Buffer;

const root = typeof window !== "undefined" ? window : globalThis;
const BURNER_KEY = "scardesk-burner";

class PhantomAdapter {
  constructor() {
    this.connected = false;
    this.publicKey = null;
    this.provider = null;
  }

  get name() {
    return "Phantom";
  }

  providerOrNull() {
    const injected = root.phantom?.solana || root.solana;
    if (injected && injected.isPhantom) return injected;
    return null;
  }

  async connect() {
    const provider = this.providerOrNull();
    if (!provider) throw new Error("Phantom is not installed in this browser.");
    const res = await provider.connect();
    const key = (res && res.publicKey) || provider.publicKey;
    this.publicKey = new PublicKey(key.toString());
    this.provider = provider;
    this.connected = true;
    return this.publicKey;
  }

  async disconnect() {
    try {
      await this.provider?.disconnect();
    } catch {
      /* extension may already be gone */
    }
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

  get name() {
    return "Solflare";
  }

  async connect() {
    const provider = root.solflare;
    if (!provider || !provider.isSolflare) throw new Error("Solflare is not installed in this browser.");
    await provider.connect();
    const key = provider.publicKey;
    if (!key) throw new Error("Solflare did not return a public key");
    this.publicKey = new PublicKey(key.toString());
    this.provider = provider;
    this.connected = true;
    return this.publicKey;
  }

  async disconnect() {
    try {
      await this.provider?.disconnect();
    } catch {
      /* ignore */
    }
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

  get name() {
    return "Browser key";
  }

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
