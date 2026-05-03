import { lookup } from 'dns/promises';
import { URL } from 'url';
import { ForbiddenError, ValidationError } from './errorHandler';
import { isPrivateIpv4 } from './safeFetch';

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
 * The DNS-rebinding race that used to live between this pre-flight and axios's
 * connect-time lookup is closed by `safeFetch.safeAxios` — its underlying
 * http(s) Agents do the same private-IP check at connect time. Use this guard
 * to give the user an early 4xx, then pass the URL through `safeAxios` for the
 * actual fetch. Both layers stay in place; they're complementary.
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
