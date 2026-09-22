import { createHash } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';

export interface CreateSnapTransactionInput {
  orderId: string;
  grossAmount: number;
}

export interface SnapTransactionResult {
  token: string;
  redirectUrl: string;
  /** true bila stub (tanpa server key / tanpa network). */
  stub: boolean;
}

/**
 * Wrapper Midtrans Snap (sandbox) — BK-03.
 *
 * MODE STUB (terdokumentasi): bila `MIDTRANS_SERVER_KEY` kosong, tidak ada
 * panggilan jaringan; dikembalikan token/URL stub deterministik dari
 * `order_id`. Ini membuat alur booking E2E + dev tanpa key tetap jalan.
 * Webhook di mode stub diverifikasi dengan server key = string kosong
 * (lihat `verifySignature`), sehingga test bisa menghitung signature yang
 * valid tanpa key asli.
 *
 * JANGAN pernah hardcode key di kode — selalu via env.
 */
@Injectable()
export class MidtransService {
  private get serverKey(): string {
    return process.env.MIDTRANS_SERVER_KEY ?? '';
  }

  private get snapUrl(): string {
    return (
      process.env.MIDTRANS_SNAP_URL ??
      'https://app.sandbox.midtrans.com/snap/v1/transactions'
    );
  }

  /** True bila berjalan tanpa server key (stub, tanpa network). */
  isStubMode(): boolean {
    return this.serverKey.length === 0;
  }

  async createTransaction(
    input: CreateSnapTransactionInput,
  ): Promise<SnapTransactionResult> {
    if (this.isStubMode()) {
      return {
        token: `stub-snap-${input.orderId}`,
        redirectUrl: `https://stub.midtrans.local/snap/${input.orderId}`,
        stub: true,
      };
    }
    const auth = Buffer.from(`${this.serverKey}:`).toString('base64');
    let res: Response;
    try {
      res = await fetch(this.snapUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: input.orderId,
            gross_amount: input.grossAmount,
          },
        }),
      });
    } catch (err) {
      throw new InternalServerErrorException(
        `Midtrans Snap unreachable: ${(err as Error).message}`,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new InternalServerErrorException(
        `Midtrans Snap failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as {
      token?: string;
      redirect_url?: string;
    };
    if (!json.token || !json.redirect_url) {
      throw new InternalServerErrorException(
        'Midtrans Snap response missing token/redirect_url',
      );
    }
    return { token: json.token, redirectUrl: json.redirect_url, stub: false };
  }

  /**
   * Verifikasi signature notifikasi Midtrans:
   * `SHA512(order_id + status_code + gross_amount + server_key)`.
   * Di mode stub server key = string kosong.
   */
  verifySignature(input: {
    orderId: string;
    statusCode: string;
    grossAmount: string;
    signatureKey: string;
  }): boolean {
    const expected = computeMidtransSignature(
      input.orderId,
      input.statusCode,
      input.grossAmount,
      this.serverKey,
    );
    return (
      expected.length === input.signatureKey.length &&
      timingSafeEqualHex(expected, input.signatureKey.toLowerCase())
    );
  }
}

/** Helper publik (dipakai juga oleh E2E untuk membangun signature valid). */
export function computeMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
): string {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
