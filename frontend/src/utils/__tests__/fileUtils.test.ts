import { formatFileSize, formatStorageSize } from '../fileUtils';

describe('fileUtils', () => {
  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1023)).toBe('1023 B');
    });

    it('formats kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1024 * 1023)).toBe('1023 KB');
    });

    it('formats megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB');
      expect(formatFileSize(1024 * 1024 * 1023)).toBe('1023 MB');
    });

    it('formats gigabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB');
    });

    it('handles custom decimal places', () => {
      expect(formatFileSize(1536, 0)).toBe('2 KB');
      expect(formatFileSize(1536, 1)).toBe('1.5 KB');
      expect(formatFileSize(1536, 3)).toBe('1.5 KB'); // Default behavior doesn't show trailing zeros
    });
  });

  describe('formatStorageSize', () => {
    it('formats MB to appropriate units', () => {
      expect(formatStorageSize(0)).toBe('0 B');
      expect(formatStorageSize(0.001)).toBe('1.02 KB'); // 0.001 MB = 1.024 KB ≈ 1.02 KB
      expect(formatStorageSize(0.5)).toBe('512 KB'); // 0.5 MB = 512 KB
      expect(formatStorageSize(1)).toBe('1 MB');
      expect(formatStorageSize(1024)).toBe('1 GB'); // 1024 MB = 1 GB
    });

    it('handles large values', () => {
      expect(formatStorageSize(2048)).toBe('2 GB');
      expect(formatStorageSize(1024 * 1024)).toBe('1 TB');
    });
  });
});
