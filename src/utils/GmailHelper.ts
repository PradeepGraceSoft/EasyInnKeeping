import { ImapFlow, MessageAddressObject } from "imapflow";
import { getCACertificates } from "node:tls";
import { ConfigManager } from "./ConfigManager";

export class GmailHelper {
  private static readonly guestHubOtpEmailSubject =
    "Your GuestHub verification code";

  static createUniqueRecipient(label: string): string {
    const email = ConfigManager.gmail.email;
    const separatorIndex = email.lastIndexOf("@");

    if (separatorIndex < 1) {
      throw new Error("env_GmailEmail must contain a valid Gmail address");
    }

    const domain = email.slice(separatorIndex + 1);
    const safeLabel = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return `${safeLabel}-${uniqueId}@${domain}`;
  }

  static async verifyEmailReceived(
    recipient: string,
    sentAfter: Date,
    timeoutMs = 60_000,
    expectedSubject?: string,
  ): Promise<void> {
    const { email, appPassword, rejectUnauthorized } = ConfigManager.gmail;

    if (!email || !appPassword) {
      throw new Error(
        "Gmail credentials are missing from the active environment configuration",
      );
    }

    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: email, pass: appPassword },
      tls: {
        rejectUnauthorized,
        ca: [...getCACertificates("bundled"), ...getCACertificates("system")],
      },
      logger: false,
    });

    await client.connect();

    try {
      const mailboxes = await client.list();
      const mailboxPaths = [
        "INBOX",
        ...mailboxes
          .filter(
            ({ specialUse }) =>
              specialUse === "\\All" || specialUse === "\\Junk",
          )
          .map(({ path }) => path),
      ].filter((path, index, paths) => paths.indexOf(path) === index);
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        for (const mailboxPath of mailboxPaths) {
          await client.mailboxOpen(mailboxPath, { readOnly: true });
          const messageIds = await client.search({ since: sentAfter });

          if (messageIds && messageIds.length > 0) {
            for await (const message of client.fetch(messageIds, {
              envelope: true,
            })) {
              if (this.hasRecipient(message.envelope?.to, recipient)
                && (!expectedSubject || message.envelope?.subject === expectedSubject)
                && (!expectedSubject || (message.envelope?.date?.getTime() ?? 0) >= sentAfter.getTime() - 1000)) {
                return;
              }
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 5_000));
        await client.noop();
      }
    } finally {
      await client.logout();
    }

    throw new Error(
      `Email sent to ${recipient} was not received in Gmail within ${timeoutMs / 1000} seconds`,
    );
  }

  static async verifyGuestHubOtpEmailReceived(
    recipient: string,
    expectedOtp: string,
    sentAfter: Date,
    timeoutMs = 60_000,
  ): Promise<void> {
    if (!/^\d{4,8}$/.test(expectedOtp)) {
      throw new Error(
        "Expected Guest Hub OTP must contain between 4 and 8 digits.",
      );
    }

    const { email, appPassword, rejectUnauthorized } = ConfigManager.gmail;
    if (!email || !appPassword) {
      throw new Error(
        "Gmail credentials are missing from the active environment configuration",
      );
    }

    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: email, pass: appPassword },
      tls: {
        rejectUnauthorized,
        ca: [...getCACertificates("bundled"), ...getCACertificates("system")],
      },
      logger: false,
    });
    await client.connect();

    try {
      const mailboxes = await client.list();
      const mailboxPaths = [
        "INBOX",
        ...mailboxes
          .filter(
            ({ specialUse }) =>
              specialUse === "\\All" || specialUse === "\\Junk",
          )
          .map(({ path }) => path),
      ].filter((path, index, paths) => paths.indexOf(path) === index);
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        for (const mailboxPath of mailboxPaths) {
          await client.mailboxOpen(mailboxPath, { readOnly: true });
          const messageIds = await client.search({ since: sentAfter });
          if (messageIds && messageIds.length > 0) {
            for await (const message of client.fetch(
              [...messageIds].reverse(),
              {
                envelope: true,
                source: true,
              },
            )) {
              if (
                !this.hasRecipient(message.envelope?.to, recipient) ||
                message.envelope?.subject !== this.guestHubOtpEmailSubject
              ) {
                continue;
              }

              const body = Buffer.from(message.source ?? []).toString("utf8");
              if (new RegExp(`\\b${expectedOtp}\\b`).test(body)) return;
            }
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        await client.noop();
      }
    } finally {
      await client.logout();
    }

    throw new Error(
      `Guest Hub OTP ${expectedOtp} was not received by ${recipient} within ${timeoutMs / 1000} seconds.`,
    );
  }

  static async getOtpFromEmail(
    recipient: string,
    sentAfter: Date,
    timeoutMs = 60_000,
  ): Promise<string> {
    const { email, appPassword, rejectUnauthorized } = ConfigManager.gmail;
    if (!email || !appPassword) {
      throw new Error(
        "Gmail credentials are missing from the active environment configuration",
      );
    }

    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: email, pass: appPassword },
      tls: {
        rejectUnauthorized,
        ca: [...getCACertificates("bundled"), ...getCACertificates("system")],
      },
      logger: false,
    });
    await client.connect();

    try {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        await client.mailboxOpen("INBOX", { readOnly: true });
        const messageIds = await client.search({ since: sentAfter });
        if (Array.isArray(messageIds) && messageIds.length > 0) {
          for await (const message of client.fetch([...messageIds].reverse(), {
            envelope: true,
            source: true,
          })) {
            if (!this.hasRecipient(message.envelope?.to, recipient)) continue;
            const body = Buffer.from(message.source ?? []).toString("utf8");
            const otp = body.match(/\b\d{4,8}\b/)?.[0];
            if (otp) return otp;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        await client.noop();
      }
    } finally {
      await client.logout();
    }

    throw new Error(
      `OTP email sent to ${recipient} was not received within ${timeoutMs / 1000} seconds`,
    );
  }

  private static hasRecipient(
    addresses: MessageAddressObject[] | undefined,
    expectedRecipient: string,
  ): boolean {
    return (
      addresses?.some(
        ({ address }) =>
          address?.toLowerCase() === expectedRecipient.toLowerCase(),
      ) ?? false
    );
  }
}
