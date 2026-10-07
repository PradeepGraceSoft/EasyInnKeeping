import dotenv from "dotenv";
import path from "node:path";

let loaded = false;

export function paymentCredential(name: string): string {
  if (!loaded) {
    dotenv.config({ path: path.resolve("config/payment-gateways.env"), quiet: true });
    loaded = true;
  }
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing payment credential ${name}. Set it in config/payment-gateways.env or the environment.`);
  }
  return value;
}
