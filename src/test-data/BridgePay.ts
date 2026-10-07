import { paymentCredential } from "../utils/PaymentGatewayConfig";

export type BridgePayConfiguration = {
  userName: string;
  password: string;
  merchantAccountCode: string;
  terminalId: string;
  merchantCode: string;
};

export const BridgePayCredentials = {
  get userName(): string { return paymentCredential("env_BridgePayUserName"); },
  get password(): string { return paymentCredential("env_BridgePayPassword"); },
  get merchantAccountCode(): string { return paymentCredential("env_BridgePayMerchantAccountCode"); },
  get terminalId(): string { return paymentCredential("env_BridgePayTerminalId"); },
  get merchantCode(): string { return paymentCredential("env_BridgePayMerchantCode"); },
} as const;

// Distinct values for configuration isolation testing, not payment processing.
export const OnlineBookingBridgePayIsolationCredentials: BridgePayConfiguration = {
  get userName(): string { return paymentCredential("env_BridgePayIsolationUserName"); },
  get password(): string { return paymentCredential("env_BridgePayIsolationPassword"); },
  get merchantAccountCode(): string { return paymentCredential("env_BridgePayIsolationMerchantAccountCode"); },
  get terminalId(): string { return paymentCredential("env_BridgePayIsolationTerminalId"); },
  get merchantCode(): string { return paymentCredential("env_BridgePayIsolationMerchantCode"); },
};
