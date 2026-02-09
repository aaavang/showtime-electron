import { decodeName } from '../../renderer/utils/DecodeName';

describe('decodeName', () => {
  it('returns plain string unchanged', () => {
    expect(decodeName('Hello World')).toBe('Hello World');
  });

  it('decodes single-encoded URI', () => {
    expect(decodeName('Hello%20World')).toBe('Hello World');
  });

  it('decodes double-encoded string', () => {
    expect(decodeName('Hello%2520World')).toBe('Hello World');
  });

  it('handles special characters', () => {
    expect(decodeName('%23')).toBe('#');
    expect(decodeName('%26')).toBe('&');
  });

  it('returns invalid encoded string as-is', () => {
    expect(decodeName('%ZZ')).toBe('%ZZ');
  });

  it('handles empty string', () => {
    expect(decodeName('')).toBe('');
  });
});
