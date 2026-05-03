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

import { isPrivateIpv4, validatingLookup } from '../safeFetch';

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
