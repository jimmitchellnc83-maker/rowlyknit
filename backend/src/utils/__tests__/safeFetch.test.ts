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

import { assertRedirectAllowed, isPrivateIpv4, safeAxios, validatingLookup } from '../safeFetch';

afterEach(() => {
  jest.clearAllMocks();
});

describe('isPrivateIpv4', () => {
  it.each([
    ['10.0.0.1'],
    ['127.0.0.1'],
    ['169.254.169.254'], // cloud metadata
    ['172.16.0.5'],
    ['172.31.255.254'],
    ['192.168.1.1'],
    ['224.0.0.1'], // multicast
  ])('flags %s as private', (ip) => {
    expect(isPrivateIpv4(ip)).toBe(true);
  });

  it.each([['8.8.8.8'], ['1.1.1.1'], ['172.32.0.1'], ['223.255.255.255']])(
    'lets %s through',
    (ip) => {
      expect(isPrivateIpv4(ip)).toBe(false);
    },
  );
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
  ])('blocks a redirect to RFC-1918 / loopback / multicast literal %s', (ip) => {
    expect(() =>
      assertRedirectAllowed({ hostname: ip, protocol: 'http:' }),
    ).toThrow();
  });

  it('blocks an IPv6 literal redirect (with and without brackets)', () => {
    expect(() =>
      assertRedirectAllowed({ hostname: '::1', protocol: 'http:' }),
    ).toThrow(/IPv6/i);
    expect(() =>
      assertRedirectAllowed({ hostname: '[::1]', protocol: 'http:' }),
    ).toThrow(/IPv6/i);
    expect(() =>
      assertRedirectAllowed({ hostname: 'fd00::1', protocol: 'http:' }),
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
    const before = safeAxios.defaults.beforeRedirect;
    expect(typeof before).toBe('function');
    // axios's beforeRedirect signature is (options, responseDetails,
    // requestDetails). Our hook only consumes `options`; the rest are
    // stubbed for the test invocation.
    const detail = {} as never;
    // And the wired callback must reject the canonical bad targets.
    expect(() =>
      before!({ hostname: '127.0.0.1', protocol: 'http:' } as never, detail, detail),
    ).toThrow();
    expect(() =>
      before!(
        { hostname: '169.254.169.254', protocol: 'http:' } as never,
        detail,
        detail,
      ),
    ).toThrow();
    // …and let a clean public target through.
    expect(() =>
      before!(
        { hostname: '93.184.216.34', protocol: 'https:' } as never,
        detail,
        detail,
      ),
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
