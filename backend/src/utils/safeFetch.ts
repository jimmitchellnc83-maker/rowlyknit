/**
 * SSRF-safe outbound HTTP client.
 *
 * The story so far: `assertPublicUrl()` resolves the URL's hostname once
 * and rejects if any answer points at a private / loopback / link-local /
 * cloud-metadata IP. That closed the obvious "user posts http://10.0.0.1"
 * pivot, but left a DNS-rebinding race: between the pre-flight `lookup`
 * and the actual TCP connect axios opens, the attacker's DNS server can
 * flip the A record from a public IP to an internal one, and Node will
 * happily connect to whatever the *second* lookup returns.
 *
 * This module closes that race by attaching a custom `lookup` to shared
 * http(s) Agents. Node calls the lookup at *connect time*, immediately
 * before opening the socket; if the resolved address is private the
 * lookup throws and the connection never opens. There's no second DNS
 * call between validation and connection — the validation IS the
 * connection-time lookup.
 *
 * Public surface:
 *   - `safeAxios` — pre-configured axios instance. Drop-in for `axios`.
 *   - `validatingLookup` — exported for tests.
 *
 * `assertPublicUrl()` is still useful for early rejection (so the user
 * gets a clear 403/400 before we open a connection at all). Both layers
 * stay in place; they're complementary, not redundant.
 */

import { lookup as dnsLookup } from 'dns';
import http from 'http';
import https from 'https';
import axios from 'axios';
import { ForbiddenError } from './errorHandler';

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

const PRIVATE_V4_RANGES = (
  [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16], // link-local; includes 169.254.169.254 (cloud metadata)
    ['172.16.0.0', 12],
    ['192.168.0.0', 16],
    ['224.0.0.0', 4], // multicast
  ] as Array<[string, number]>
).map(([ip, bits]) => ({ base: ipv4ToInt(ip), bits }));

export function isPrivateIpv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  return PRIVATE_V4_RANGES.some(({ base, bits }) => {
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (ipInt & mask) === (base & mask);
  });
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string,
  family: number,
) => void;

type LookupAllCallback = (
  err: NodeJS.ErrnoException | null,
  addresses: { address: string; family: number }[],
) => void;

interface LookupOptions {
  family?: number;
  hints?: number;
  all?: boolean;
  verbatim?: boolean;
}

/**
 * Custom DNS lookup that runs Node's resolver and rejects any answer
 * that resolves to a private/internal/IPv6 address. Node's `Agent`
 * accepts this signature directly (see `http.Agent` `lookup` option).
 */
export function validatingLookup(
  hostname: string,
  options: LookupOptions | number | LookupCallback,
  callback?: LookupCallback | LookupAllCallback,
): void {
  // Normalize the overloads. Node calls this two ways:
  //   lookup(hostname, optionsOrFamily, cb)
  //   lookup(hostname, cb)
  let opts: LookupOptions = {};
  let cb: LookupCallback | LookupAllCallback;
  if (typeof options === 'function') {
    cb = options;
  } else if (typeof options === 'number') {
    opts = { family: options };
    cb = callback as LookupCallback;
  } else {
    opts = options ?? {};
    cb = callback as LookupCallback | LookupAllCallback;
  }

  dnsLookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) {
      (cb as LookupCallback)(err, '', 0);
      return;
    }

    const list = Array.isArray(addresses) ? addresses : [addresses];

    for (const entry of list) {
      const family = (entry as { family: number }).family;
      const address = (entry as { address: string }).address;
      if (family === 6) {
        const e: NodeJS.ErrnoException = new ForbiddenError(
          `IPv6 destinations are not allowed (${address})`,
        );
        e.code = 'EAI_AGAIN';
        (cb as LookupCallback)(e, '', 0);
        return;
      }
      if (isPrivateIpv4(address)) {
        const e: NodeJS.ErrnoException = new ForbiddenError(
          `URL resolves to a private/internal address: ${address}`,
        );
        e.code = 'EAI_AGAIN';
        (cb as LookupCallback)(e, '', 0);
        return;
      }
    }

    if (opts.all) {
      (cb as LookupAllCallback)(null, list as { address: string; family: number }[]);
    } else {
      const first = list[0];
      (cb as LookupCallback)(null, first.address, first.family);
    }
  });
}

/**
 * Shared HTTP/HTTPS agents that re-validate every connection at the
 * connect-time DNS lookup. Use these on every outbound fetch where the
 * URL is influenced by user input.
 */
export const safeHttpAgent = new http.Agent({ lookup: validatingLookup as never });
export const safeHttpsAgent = new https.Agent({ lookup: validatingLookup as never });

/**
 * Pre-configured axios instance. Drop-in replacement for `axios` at any
 * call site that takes a user-supplied URL. Behaves like axios in every
 * other way; the agents handle the safety.
 */
export const safeAxios = axios.create({
  httpAgent: safeHttpAgent,
  httpsAgent: safeHttpsAgent,
});
