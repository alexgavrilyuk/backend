// tests/utils/fileProcessing.test.js

const { detectColumnType, validateFile } = require('../../utils/fileProcessing');

describe('File Processing Utilities', () => {
  describe('detectColumnType', () => {
    test('should detect integer columns', () => {
      const samples = ['1', '2', '3', '-5', '0'];
      expect(detectColumnType(samples)).toBe('integer');
    });

    test('should detect float columns', () => {
      const samples = ['1.5', '2.0', '-3.14', '0.0'];
      expect(detectColumnType(samples)).toBe('float');
    });

    test('should detect date columns', () => {
      const samples = ['2023-01-01', '2023-01-02', '2023-01-03'];
      expect(detectColumnType(samples)).toBe('date');
    });

    test('should detect boolean columns', () => {
      const samples = ['true', 'false', 'yes', 'no'];
      expect(detectColumnType(samples)).toBe('boolean');
    });

    test('should default to string for mixed content', () => {
      const samples = ['abc', '123', 'true', '2023-01-01'];
      expect(detectColumnType(samples)).toBe('string');
    });

    test('should default to string for empty samples', () => {
      const samples = [];
      expect(detectColumnType(samples)).toBe('string');
    });

    test('should handle null/undefined values in samples', () => {
      const samples = [null, undefined, '', '1', '2'];
      expect(detectColumnType(samples)).toBe('integer');
    });
  });

  describe('validateFile', () => {
    test('should validate CSV files', () => {
      const file = {
        name: 'test.csv',
        mimetype: 'text/csv',
        size: 1024 * 10 // 10 KB
      };

      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    test('should validate Excel files', () => {
      const file = {
        name: 'test.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 1024 * 10 // 10 KB
      };

      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    test('should reject files that are too large', () => {
      const file = {
        name: 'test.csv',
        mimetype: 'text/csv',
        size: 1024 * 1024 * 101 // 101 MB
      };

      const result = validateFile(file, 100); // max 100 MB
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds the maximum limit');
    });

    test('should reject invalid file types', () => {
      const file = {
        name: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 10 // 10 KB
      };

      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    test('should reject invalid file extensions', () => {
      const file = {
        name: 'test.txt',
        mimetype: 'text/plain',
        size: 1024 * 10 // 10 KB
      };

      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file extension');
    });

    test('should reject missing files', () => {
      const result = validateFile(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No file provided');
    });
  });
});