/**
 * SSRF-safe outbound HTTP client.
 *
 * The story so far: `assertPublicUrl()` resolves the URL's hostname once
 * and rejects if any answer points at a non-globally-routable IP — every
 * RFC 6890 special-use range we know about (RFC-1918 private, loopback,
 * link-local incl. cloud metadata, CGNAT, IETF protocol/test-net,
 * benchmarking, multicast, class-E reserved, plus all IPv6 by current
 * policy). That closed the obvious "user posts http://10.0.0.1" pivot,
 * but left a DNS-rebinding race: between the pre-flight `lookup` and the
 * actual TCP connect axios opens, the attacker's DNS server can flip the
 * A record from a public IP to an internal one, and Node will happily
 * connect to whatever the *second* lookup returns.
 *
 * This module closes that race by attaching a custom `lookup` to shared
 * http(s) Agents. Node calls the lookup at *connect time*, immediately
 * before opening the socket; if the resolved address is private the
 * lookup throws and the connection never opens. There's no second DNS
 * call between validation and connection — the validation IS the
 * connection-time lookup.
 *
 * One more wrinkle: when the URL the agent ends up dialing is a *literal
 * IP* (e.g. `http://127.0.0.1/`), Node skips the DNS lookup entirely —
 * there's nothing to resolve. So the agent's `validatingLookup` never
 * fires. That doesn't matter for the initial URL (assertPublicUrl
 * catches it), but it does matter for *redirects*: a public host can
 * 302 the client to `http://127.0.0.1/` and follow-redirects will dial
 * the literal IP without consulting our lookup hook. We close that gap
 * with `assertRedirectAllowed`, wired through axios's `beforeRedirect`
 * config — see PR #369 (Codex follow-up).
 *
 * Public surface:
 *   - `safeAxios` — pre-configured axios instance. Drop-in for `axios`.
 *   - `validatingLookup` — exported for tests.
 *   - `assertRedirectAllowed` — exported for tests.
 *
 * `assertPublicUrl()` is still useful for early rejection (so the user
 * gets a clear 403/400 before we open a connection at all). All three
 * layers stay in place; they're complementary, not redundant.
 */

import { lookup as dnsLookup } from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';
import axios from 'axios';
import { ForbiddenError } from './errorHandler';

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

/**
 * Every non-globally-routable IPv4 range we will ever see, sourced from
 * IANA's special-use registry (RFC 6890 et al.). The previous list only
 * caught RFC-1918, loopback, link-local, and class-D multicast — which
 * left CGNAT (100.64/10), benchmarking (198.18/15), the IETF protocol
 * block (192.0.0/24), TEST-NET docs (192.0.2/24, 198.51.100/24,
 * 203.0.113/24), and the entire reserved class-E (240.0.0/4) wide
 * open. An attacker who controls a public DNS hostname can resolve to
 * any of those and the connect-time / pre-flight guards would have
 * waved them through.
 *
 * Order doesn't matter (every test is independent), but kept sorted by
 * first octet for readability.
 */
const NON_PUBLIC_V4_RANGES = (
  [
    ['0.0.0.0', 8], // "this network" / unspecified
    ['10.0.0.0', 8], // RFC-1918 private
    ['100.64.0.0', 10], // CGNAT (RFC 6598)
    ['127.0.0.0', 8], // loopback
    ['169.254.0.0', 16], // link-local; includes 169.254.169.254 (cloud metadata)
    ['172.16.0.0', 12], // RFC-1918 private
    ['192.0.0.0', 24], // IETF protocol assignments (RFC 6890)
    ['192.0.2.0', 24], // TEST-NET-1 documentation
    ['192.168.0.0', 16], // RFC-1918 private
    ['198.18.0.0', 15], // network device benchmarking (RFC 2544)
    ['198.51.100.0', 24], // TEST-NET-2 documentation
    ['203.0.113.0', 24], // TEST-NET-3 documentation
    ['224.0.0.0', 4], // class-D multicast
    ['240.0.0.0', 4], // class-E reserved (incl. 255.255.255.255 broadcast)
  ] as Array<[string, number]>
).map(([ip, bits]) => ({ base: ipv4ToInt(ip), bits }));

/**
 * Renamed from `isPrivateIpv4` to `isNonPublicIpv4` because the previous
 * name understated what the function actually has to catch. The old
 * name is re-exported below to keep external imports working.
 */
export function isNonPublicIpv4(ip: string): boolean {
  if (typeof ip !== 'string' || ip.length === 0) return true;
  const parts = ip.split('.');
  if (parts.length !== 4) return true;
  for (const oct of parts) {
    if (!/^\d+$/.test(oct)) return true;
    const n = Number(oct);
    if (!Number.isInteger(n) || n < 0 || n > 255) return true;
  }
  const ipInt = ipv4ToInt(ip);
  return NON_PUBLIC_V4_RANGES.some(({ base, bits }) => {
    if (bits === 0) return true;
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (ipInt & mask) === (base & mask);
  });
}

/**
 * Backwards-compat alias. The old name is what `ssrfGuard.ts` and the
 * existing `safeFetch` test suite import. Kept as an alias so the
 * blast radius of this PR stays inside this file.
 */
export const isPrivateIpv4 = isNonPublicIpv4;

/**
 * IPv6 special-use coverage. The connect-time + redirect-time guards
 * have always rejected ALL IPv6 (defense in depth — every public CDN
 * we hit has a v4 record), but if that policy ever loosens this list
 * is the gate. Sourced from RFC 6890 / 4291 / 4193 / 5180 / 7723.
 *
 * Implementation note: we expand each address into a single
 * 128-bit BigInt, mask, and compare. Node's `net.isIPv6` validates
 * the form before we ever call this.
 */
const NON_PUBLIC_V6_PREFIXES: Array<{ prefix: bigint; bits: number }> = [
  { prefix: 0n, bits: 128 }, // ::/128 unspecified
  { prefix: 1n, bits: 128 }, // ::1/128 loopback
  { prefix: 0xfe80n << 112n, bits: 10 }, // fe80::/10 link-local
  { prefix: 0xfc00n << 112n, bits: 7 }, // fc00::/7 unique-local (incl. fd00::/8)
  { prefix: 0xff00n << 112n, bits: 8 }, // ff00::/8 multicast
  { prefix: 0x2001n << 112n, bits: 23 }, // 2001::/23 IETF protocol assignments
  // 2001:db8::/32 documentation prefix (RFC 3849). Not in 2001::/23 —
  // /23 only covers 2001:0000–2001:01ff. Listed separately so it's
  // explicit, not implicit.
  { prefix: 0x20010db8n << 96n, bits: 32 },
  { prefix: 0x100n << 112n, bits: 64 }, // 100::/64 discard prefix
  // IPv4-mapped (::ffff:0:0/96) — anything mapped here MUST resolve
  // through the IPv4 list rather than be allowed on its v6 face.
  { prefix: 0xffffn << 32n, bits: 96 },
  // IPv4-compatible (::/96) — historic but worth blocking explicitly.
  { prefix: 0n, bits: 96 },
];

function ipv6ToBigInt(ip: string): bigint | null {
  // Reject scopes (`fe80::1%eth0`) — Node strips them, but be explicit.
  const cleaned = ip.split('%')[0];
  if (!cleaned.includes(':')) return null;
  // Handle :: shorthand by expanding to full 8 groups.
  let head: string[] = [];
  let tail: string[] = [];
  if (cleaned.includes('::')) {
    const [h, t] = cleaned.split('::');
    head = h ? h.split(':') : [];
    tail = t ? t.split(':') : [];
  } else {
    head = cleaned.split(':');
  }
  // Expand a trailing IPv4-in-IPv6 form (e.g. ::ffff:1.2.3.4) into two
  // hex groups. Without this, "::ffff:127.0.0.1" parses as 8+ groups.
  const lastInTail = tail[tail.length - 1];
  const lastInHead = head[head.length - 1];
  function v4Tail(seg: string | undefined, source: string[]): boolean {
    if (!seg || !seg.includes('.')) return false;
    const v4Int = ipv4ToInt(seg);
    const hi = (v4Int >>> 16) & 0xffff;
    const lo = v4Int & 0xffff;
    source.pop();
    source.push(hi.toString(16), lo.toString(16));
    return true;
  }
  v4Tail(lastInTail, tail) || v4Tail(lastInHead, head);
  const totalGroups = head.length + tail.length;
  if (totalGroups > 8) return null;
  const fillCount = 8 - totalGroups;
  const groups = [
    ...head,
    ...new Array(fillCount).fill('0'),
    ...tail,
  ];
  if (groups.length !== 8) return null;
  let result = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    result = (result << 16n) | BigInt(parseInt(g, 16));
  }
  return result;
}

export function isNonPublicIpv6(ip: string): boolean {
  const value = ipv6ToBigInt(ip);
  if (value === null) return true; // unparseable → treat as unsafe
  for (const { prefix, bits } of NON_PUBLIC_V6_PREFIXES) {
    if (bits === 0) return true;
    const mask = bits === 128 ? -1n : ((1n << BigInt(bits)) - 1n) << BigInt(128 - bits);
    if ((value & mask) === (prefix & mask)) return true;
  }
  return false;
}

/**
 * Single entry point: is this address globally routable?
 * Returns true ONLY for ordinary public unicast IPv4. IPv6 returns
 * `false` here; current policy still drops every v6 destination at
 * the lookup hook + redirect guard. If/when that policy widens,
 * `isNonPublicIpv6` is the gate.
 */
export function isGloballyRoutableIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return !isNonPublicIpv4(ip);
  if (family === 6) return false;
  return false;
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
 * Validate the next hop in a redirect chain. axios passes this through
 * to follow-redirects via the `beforeRedirect` config; the callback
 * runs synchronously *before* the redirected request is dispatched, so
 * throwing here cancels the chain.
 *
 * What we check:
 *   - The next protocol must be http/https. A redirect to `file:` or
 *     `gopher:` would otherwise let an attacker pivot through axios's
 *     adapter into the local filesystem.
 *   - If the redirect target is a *literal IP*, validate it against our
 *     private/internal block list directly. Node bypasses DNS lookup
 *     for IP literals, so the agent's `validatingLookup` would never
 *     fire — this is the gap the Codex review on PR #369 flagged.
 *   - If the redirect target is a *DNS hostname*, defer to the agent's
 *     connect-time `validatingLookup`. follow-redirects opens a fresh
 *     connection through the same http(s) Agent on every hop, so the
 *     lookup runs and rejects private resolutions for us.
 *
 * Errors here propagate as the rejection of the original axios call.
 * We use `ForbiddenError` so the existing 403 mapping at upload/import
 * call sites stays intact.
 */
export function assertRedirectAllowed(options: {
  hostname?: string | null;
  protocol?: string | null;
}): void {
  const protocol = options.protocol;
  if (protocol && protocol !== 'http:' && protocol !== 'https:') {
    throw new ForbiddenError(`Unsupported redirect protocol: ${protocol}`);
  }
  const host = options.hostname;
  if (typeof host !== 'string' || host.length === 0) return;
  // Strip IPv6 brackets — follow-redirects sometimes hands us
  // `[::1]` and sometimes `::1`. Either should be rejected.
  const stripped = host.startsWith('[') && host.endsWith(']')
    ? host.slice(1, -1)
    : host;
  const family = net.isIP(stripped);
  if (family === 6) {
    throw new ForbiddenError(
      `Redirect to IPv6 destination blocked: ${stripped}`,
    );
  }
  if (family === 4 && isPrivateIpv4(stripped)) {
    throw new ForbiddenError(
      `Redirect to private/internal address blocked: ${stripped}`,
    );
  }
  // For DNS hostnames the agent's `validatingLookup` runs at connect
  // time and rejects there if the resolution is private. No further
  // synchronous work needed here.
}

/**
 * Pre-configured axios instance. Drop-in replacement for `axios` at any
 * call site that takes a user-supplied URL. Behaves like axios in every
 * other way; the agents + beforeRedirect hook handle the safety.
 */
export const safeAxios = axios.create({
  httpAgent: safeHttpAgent,
  httpsAgent: safeHttpsAgent,
  beforeRedirect: (options) => {
    assertRedirectAllowed(options as { hostname?: string | null; protocol?: string | null });
  },
});
