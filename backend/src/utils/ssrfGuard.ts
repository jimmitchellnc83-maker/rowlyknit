import { lookup } from 'dns/promises';
import { URL } from 'url';
import { ForbiddenError, ValidationError } from './errorHandler';

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
    ['224.0.0.0', 4],    // multicast
  ] as Array<[string, number]>
).map(([ip, bits]) => ({ base: ipv4ToInt(ip), bits }));

function isPrivateIpv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  return PRIVATE_V4_RANGES.some(({ base, bits }) => {
    const mask = (0xFFFFFFFF << (32 - bits)) >>> 0;
    return (ipInt & mask) === (base & mask);
  });
}

/**
 * SSRF guard for outbound HTTP fetches against URLs derived from user-controlled
 * data (e.g. PDF collation pulling from `pattern_files.file_path`).
 *
 * Rejects:
 *   - non-http(s) protocols
 *   - hostnames that resolve to IPv6 (defense in depth: most public CDNs work
 *     fine over v4, and v6 ranges aren't covered here)
 *   - hostnames that resolve to RFC-1918 / loopback / link-local / multicast,
 *     including the 169.254.169.254 cloud-metadata sink.
 *
 * Known limitation: there's a tiny race between this lookup and axios's own
 * connect-time lookup, so DNS rebinding can still slip past. To fully close
 * that, pass a custom `lookup` to a shared http(s) Agent and re-validate at
 * connection time. Out of scope for the MVP fix.
 */
export async function assertPublicUrl(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new ValidationError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError(`Unsupported URL protocol: ${url.protocol}`);
  }

  const results = await lookup(url.hostname, { all: true });
  for (const { address, family } of results) {
    if (family === 6) {
      throw new ForbiddenError('IPv6 destinations are not allowed');
    }
    if (isPrivateIpv4(address)) {
      throw new ForbiddenError(
        `URL resolves to a private/internal address: ${address}`
      );
    }
  }
  return url;
}
