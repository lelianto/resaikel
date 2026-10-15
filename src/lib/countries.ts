/**
 * Country and currency options.
 *
 * A deliberately short list rather than a full ISO dataset: every option is one
 * the product has been reasoned about. Adding more is a data change, not a code
 * change.
 */

export const CONTACTS = [
  { code: 'ID', label: 'Indonesia' },
  { code: 'SG', label: 'Singapore' },
  { code: 'MY', label: 'Malaysia' },
  { code: 'TH', label: 'Thailand' },
  { code: 'VN', label: 'Vietnam' },
  { code: 'PH', label: 'Philippines' },
  { code: 'IN', label: 'India' },
  { code: 'AU', label: 'Australia' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'DE', label: 'Germany' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
] as const;

export const CURRENCY_CODES = [
  'IDR',
  'SGD',
  'MYR',
  'THB',
  'VND',
  'PHP',
  'INR',
  'AUD',
  'EUR',
  'GBP',
  'USD',
] as const;

export const LOCALE_CODES = [
  { value: 'id-ID', label: 'Bahasa Indonesia' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-US', label: 'English (United States)' },
] as const;
