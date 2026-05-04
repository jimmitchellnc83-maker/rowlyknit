/**
 * Unit tests for safeFetch — proves the connect-time DNS validation
 * actually rejects private/internal/IPv6 addresses, so user-controlled
 * fetches can't be DNS-rebound onto our infra.
 */

const dnsLookupMock = jest.fn();
jest.mock('dns', () => ({
  ...jest.requireActual('dns'),
  lookup: (...args: any[]) => dnsLookupMock(...args),
}));

import {
  assertRedirectAllowed,
  isGloballyRoutableIp,
  isNonPublicIpv4,
  isNonPublicIpv6,
  isPrivateIpv4,
  safeAxios,
  validatingLookup,
} from '../safeFetch';

afterEach(() => {
  jest.clearAllMocks();
});

describe('isNonPublicIpv4 (and the legacy isPrivateIpv4 alias)', () => {
  /**
   * Audit: every range listed in IANA's special-use registry must be
   * flagged. The legacy name only covered ~5 of them and SSRF flowed
   * through CGNAT (100.64/10), benchmarking (198.18/15), and the
   * 240/4 reserved block.
   */
  it.each([
    // The original baseline, kept so a regression on the old set fails loud:
    ['10.0.0.1'],
    ['127.0.0.1'],
    ['169.254.169.254'], // cloud metadata
    ['172.16.0.5'],
    ['172.31.255.254'],
    ['192.168.1.1'],
    ['224.0.0.1'], // multicast
    // Newly covered ranges (the regression set the task pinned):
    ['100.64.0.1'], // CGNAT (RFC 6598)
    ['100.127.255.254'], // CGNAT upper edge
    ['198.18.0.1'], // benchmarking (RFC 2544)
    ['198.19.255.254'], // benchmarking upper edge
    ['192.0.0.1'], // IETF protocol assignments (RFC 6890)
    ['192.0.0.255'], // /24 upper edge
    ['192.0.2.1'], // TEST-NET-1
    ['198.51.100.1'], // TEST-NET-2
    ['203.0.113.1'], // TEST-NET-3
    ['240.0.0.1'], // class-E reserved
    ['255.255.255.255'], // broadcast
    ['0.0.0.0'], // unspecified
  ])('flags %s as non-public', (ip) => {
    expect(isNonPublicIpv4(ip)).toBe(true);
    expect(isPrivateIpv4(ip)).toBe(true);
  });

  it.each([
    ['8.8.8.8'],
    ['1.1.1.1'],
    ['100.63.255.254'], // just below CGNAT
    ['100.128.0.1'], // just above CGNAT
    ['172.32.0.1'],
    ['198.17.255.254'], // just below benchmarking
    ['198.20.0.1'], // just above benchmarking
    ['192.0.1.1'], // between 192.0.0/24 and 192.0.2/24
    ['203.0.114.1'], // just above TEST-NET-3
    ['223.255.255.255'],
    ['239.255.255.255'], // class-D upper edge — wait, this is actually multicast, see next test
  ])('lets %s through', (ip) => {
    if (ip === '239.255.255.255') {
      // 239.x is still multicast (224/4 covers 224..239). Skip the
      // assertion — kept in the table only so a future contributor
      // sees the boundary.
      expect(isNonPublicIpv4(ip)).toBe(true);
    } else {
      expect(isNonPublicIpv4(ip)).toBe(false);
      expect(isPrivateIpv4(ip)).toBe(false);
    }
  });

  it('rejects malformed v4 strings as unsafe (defense in depth)', () => {
    expect(isNonPublicIpv4('')).toBe(true);
    expect(isNonPublicIpv4('not-an-ip')).toBe(true);
    expect(isNonPublicIpv4('256.0.0.1')).toBe(true);
    expect(isNonPublicIpv4('1.2.3')).toBe(true);
  });
});

describe('isNonPublicIpv6', () => {
  it.each([
    ['::'], // unspecified
    ['::1'], // loopback
    ['fe80::1'], // link-local
    ['fe80::dead:beef'],
    ['fc00::1'], // unique-local lower
    ['fd00::abcd'], // unique-local /8 (most common ULA)
    ['fdff:ffff::1'], // ULA upper
    ['ff02::1'], // multicast all-nodes
    ['ff05::1:3'], // site-local multicast
    ['2001::1'], // teredo / IETF protocol
    ['2001:db8::1'], // documentation
    ['100::1'], // discard prefix
    ['::ffff:127.0.0.1'], // IPv4-mapped of loopback
    ['::ffff:10.0.0.1'], // IPv4-mapped of RFC-1918
    ['::ffff:169.254.169.254'], // mapped cloud metadata
  ])('flags %s as non-public', (ip) => {
    expect(isNonPublicIpv6(ip)).toBe(true);
  });

  it.each([
    ['2606:4700:4700::1111'], // Cloudflare 1.1.1.1 v6
    ['2620:fe::fe'], // Quad9 v6
    ['2a00:1450:4001:81b::200e'], // google.com v6 representative
  ])('lets %s through', (ip) => {
    expect(isNonPublicIpv6(ip)).toBe(false);
  });
});

describe('isGloballyRoutableIp', () => {
  it('returns true only for public IPv4', () => {
    expect(isGloballyRoutableIp('8.8.8.8')).toBe(true);
    expect(isGloballyRoutableIp('1.1.1.1')).toBe(true);
    expect(isGloballyRoutableIp('10.0.0.1')).toBe(false);
    expect(isGloballyRoutableIp('100.64.0.1')).toBe(false);
    expect(isGloballyRoutableIp('198.18.0.1')).toBe(false);
    // Current policy: drop every v6 destination at the boundary even
    // when the address itself is publicly routable.
    expect(isGloballyRoutableIp('2606:4700:4700::1111')).toBe(false);
    expect(isGloballyRoutableIp('not-an-ip')).toBe(false);
  });
});

describe('validatingLookup', () => {
  it('passes a public IPv4 result through (legacy callback shape)', (done) => {
    dnsLookupMock.mockImplementationOnce((_host, _opts, cb) => {
      cb(null, [{ address: '93.184.216.34', family: 4 }]);
    });
    validatingLookup('example.com', {}, (err, address, family) => {
      expect(err).toBeNull();
      expect(address).toBe('93.184.216.34');
      expect(family).toBe(4);
      done();
    });
  });

  it('rejects when the resolved address is private', (done) => {
    dnsLookupMock.mockImplementationOnce((_host, _opts, cb) => {
      cb(null, [{ address: '169.254.169.254', family: 4 }]);
    });
    validatingLookup('rebound.example.com', {}, (err: NodeJS.ErrnoException | null) => {
      expect(err).not.toBeNull();
      expect(err!.message).toMatch(/private\/internal address/i);
      done();
    });
  });

  it('rejects when ANY result in an `all` lookup is private (defense in depth)', (done) => {
    dnsLookupMock.mockImplementationOnce((_host, _opts, cb) => {
      cb(null, [
        { address: '93.184.216.34', family: 4 }, // public
        { address: '10.0.0.5', family: 4 }, // private
      ]);
    });
    validatingLookup('mixed.example.com', { all: true }, (err: NodeJS.ErrnoException | null) => {
      expect(err).not.toBeNull();
      expect(err!.message).toMatch(/10\.0\.0\.5/);
      done();
    });
  });

  it('rejects IPv6 destinations (matches assertPublicUrl)', (done) => {
    dnsLookupMock.mockImplementationOnce((_host, _opts, cb) => {
      cb(null, [{ address: '2606:4700:4700::1111', family: 6 }]);
    });
    validatingLookup('v6.example.com', {}, (err: NodeJS.ErrnoException | null) => {
      expect(err).not.toBeNull();
      expect(err!.message).toMatch(/IPv6/i);
      done();
    });
  });

  it('returns the full list when called with all:true and every entry is public', (done) => {
    dnsLookupMock.mockImplementationOnce((_host, _opts, cb) => {
      cb(null, [
        { address: '93.184.216.34', family: 4 },
        { address: '8.8.8.8', family: 4 },
      ]);
    });
    validatingLookup('multi.example.com', { all: true }, ((err: any, addresses: any) => {
      expect(err).toBeNull();
      expect(addresses).toHaveLength(2);
      expect(addresses[0].address).toBe('93.184.216.34');
      done();
    }) as any);
  });

  it('propagates DNS errors unchanged', (done) => {
    const dnsErr: NodeJS.ErrnoException = Object.assign(new Error('ENOTFOUND'), {
      code: 'ENOTFOUND',
    });
    dnsLookupMock.mockImplementationOnce((_host, _opts, cb) => {
      cb(dnsErr);
    });
    validatingLookup('nx.example.com', {}, (err: NodeJS.ErrnoException | null) => {
      expect(err).toBe(dnsErr);
      done();
    });
  });
});

describe('assertRedirectAllowed', () => {
  /**
   * The redirect-time guard is what closes the gap that survived the
   * connect-time `validatingLookup`: when a redirect target is a
   * literal IP, Node skips DNS, so the lookup hook never fires. The
   * call sites in patternsController / uploadsController /
   * blogExtractorService all use `safeAxios`, and `safeAxios` wires
   * this guard into `beforeRedirect`. Locking it here is what stops a
   * regression of "public host 302 → http://127.0.0.1/".
   */

  it('blocks a redirect to http://127.0.0.1', () => {
    expect(() =>
      assertRedirectAllowed({ hostname: '127.0.0.1', protocol: 'http:' }),
    ).toThrow(/private\/internal address/i);
  });

  it('blocks a redirect to http://169.254.169.254 (cloud metadata)', () => {
    expect(() =>
      assertRedirectAllowed({ hostname: '169.254.169.254', protocol: 'http:' }),
    ).toThrow(/169\.254\.169\.254/);
  });

  it.each([
    ['10.0.0.5'],
    ['172.16.0.1'],
    ['172.31.255.254'],
    ['192.168.1.10'],
    ['224.0.0.1'], // multicast
    ['0.0.0.0'],
    // Newly enforced ranges per the auth+security hardening sprint:
    ['100.64.0.5'], // CGNAT
    ['100.127.255.1'], // CGNAT upper edge
    ['198.18.0.5'], // benchmarking
    ['198.19.255.1'], // benchmarking upper edge
    ['192.0.0.5'], // IETF protocol assignments
    ['192.0.2.5'], // TEST-NET-1 docs
    ['198.51.100.5'], // TEST-NET-2 docs
    ['203.0.113.5'], // TEST-NET-3 docs
    ['240.0.0.5'], // class-E reserved
    ['255.255.255.255'], // broadcast
  ])('blocks a redirect to non-public literal %s', (ip) => {
    expect(() =>
      assertRedirectAllowed({ hostname: ip, protocol: 'http:' }),
    ).toThrow();
  });

  it('blocks an IPv6 literal redirect (with and without brackets) including ULA + link-local + multicast', () => {
    expect(() =>
      assertRedirectAllowed({ hostname: '::1', protocol: 'http:' }),
    ).toThrow(/IPv6/i);
    expect(() =>
      assertRedirectAllowed({ hostname: '[::1]', protocol: 'http:' }),
    ).toThrow(/IPv6/i);
    expect(() =>
      assertRedirectAllowed({ hostname: 'fd00::1', protocol: 'http:' }),
    ).toThrow(/IPv6/i);
    expect(() =>
      assertRedirectAllowed({ hostname: 'fc00::5', protocol: 'http:' }),
    ).toThrow(/IPv6/i);
    expect(() =>
      assertRedirectAllowed({ hostname: 'fe80::dead:beef', protocol: 'http:' }),
    ).toThrow(/IPv6/i);
    expect(() =>
      assertRedirectAllowed({ hostname: 'ff02::1', protocol: 'http:' }),
    ).toThrow(/IPv6/i);
  });

  it('blocks a redirect that switches to a non-http(s) protocol', () => {
    expect(() =>
      assertRedirectAllowed({ hostname: 'cdn.example.com', protocol: 'file:' }),
    ).toThrow(/Unsupported redirect protocol/i);
    expect(() =>
      assertRedirectAllowed({ hostname: 'cdn.example.com', protocol: 'gopher:' }),
    ).toThrow(/Unsupported redirect protocol/i);
  });

  it('passes a redirect to a public IPv4 literal through', () => {
    expect(() =>
      assertRedirectAllowed({ hostname: '93.184.216.34', protocol: 'https:' }),
    ).not.toThrow();
    expect(() =>
      assertRedirectAllowed({ hostname: '8.8.8.8', protocol: 'http:' }),
    ).not.toThrow();
  });

  it('passes a redirect to a public DNS hostname through (defers to connect-time lookup)', () => {
    // For non-literal hostnames the synchronous guard cannot do DNS;
    // it returns successfully and lets the agent's validatingLookup
    // catch a private resolution at connect time. We exercise that
    // contract above in the validatingLookup describe block.
    expect(() =>
      assertRedirectAllowed({ hostname: 'cdn.example.com', protocol: 'https:' }),
    ).not.toThrow();
  });

  it('safeAxios wires assertRedirectAllowed into beforeRedirect', () => {
    // Regression: any future drop of `beforeRedirect` from safeAxios's
    // defaults would silently re-open the redirect SSRF gap.
    //
    // axios's `beforeRedirect` signature has shifted across releases —
    // older versions had `(options, responseDetails)`, newer ones add
    // `requestDetails` as a third arg. Our runtime hook only consumes
    // `options`; the rest are ignored. Cast through a permissive shape
    // so the test compiles against either typing without weakening the
    // redirect-SSRF coverage below.
    type RedirectHookForTest = (
      options: Record<string, unknown>,
      ...rest: unknown[]
    ) => void;
    const before = safeAxios.defaults.beforeRedirect as RedirectHookForTest | undefined;
    expect(typeof before).toBe('function');
    // The wired callback must reject the canonical bad targets.
    expect(() =>
      before!({ hostname: '127.0.0.1', protocol: 'http:' }),
    ).toThrow();
    expect(() =>
      before!({ hostname: '169.254.169.254', protocol: 'http:' }),
    ).toThrow();
    // …and let a clean public target through.
    expect(() =>
      before!({ hostname: '93.184.216.34', protocol: 'https:' }),
    ).not.toThrow();
  });

  it('safeAxios still uses the validating http(s) Agents (regression: redirect fix did not unwire connect-time guard)', () => {
    // The redirect-time guard catches IP literals; the connect-time
    // agent guard catches DNS-rebinding. We need both. Lock the agent
    // wiring so a future config refactor cannot drop the connect-time
    // layer while keeping the redirect layer in place.
    expect(safeAxios.defaults.httpAgent).toBeDefined();
    expect(safeAxios.defaults.httpsAgent).toBeDefined();
    expect(
      (safeAxios.defaults.httpAgent as { options?: { lookup?: unknown } }).options?.lookup,
    ).toBe(validatingLookup);
    expect(
      (safeAxios.defaults.httpsAgent as { options?: { lookup?: unknown } }).options?.lookup,
    ).toBe(validatingLookup);
  });
});
