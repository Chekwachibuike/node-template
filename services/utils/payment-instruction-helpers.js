// services/utils/payment-instruction-helpers.js
// All helper functions used by the parser and service.
// IMPORTANT: No regular expressions are used anywhere.

function isPositiveIntegerString(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function isSupportedCurrency(code) {
  if (!code || typeof code !== 'string') return false;
  const upper = code.toUpperCase();
  const supported = ['NGN', 'USD', 'GBP', 'GHS'];
  for (let i = 0; i < supported.length; i += 1) {
    if (supported[i] === upper) return true;
  }
  return false;
}

function isValidAccountId(id) {
  if (!id || typeof id !== 'string') return false;
  for (let i = 0; i < id.length; i += 1) {
    const ch = id.charAt(i);
    const code = id.charCodeAt(i);
    const isDigit = code >= 48 && code <= 57;
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    const isAllowedSymbol = ch === '-' || ch === '.' || ch === '@';
    if (!(isDigit || isUpper || isLower || isAllowedSymbol)) return false;
  }
  return true;
}

function isAllDigits(str) {
  if (!str || typeof str !== 'string' || str.length === 0) return false;
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function getDaysInMonth(year, month) {
  const days = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return days[month - 1];
}

function parseUtcDateOnly(dateStr) {
  // Strict YYYY-MM-DD validation without regex
  if (typeof dateStr !== 'string' || dateStr.length !== 10) return { isValid: false };
  if (dateStr.charAt(4) !== '-' || dateStr.charAt(7) !== '-') return { isValid: false };

  const yearStr = dateStr.substring(0, 4);
  const monthStr = dateStr.substring(5, 7);
  const dayStr = dateStr.substring(8, 10);

  if (!isAllDigits(yearStr) || !isAllDigits(monthStr) || !isAllDigits(dayStr)) {
    return { isValid: false };
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12) return { isValid: false };
  const max = getDaysInMonth(year, month);
  if (day < 1 || day > max) return { isValid: false };

  const value = Date.UTC(year, month - 1, day);
  return { isValid: true, value };
}

function getTodayUtcDateValue() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// normalizeWhitespace: NO REGEX
function normalizeWhitespace(s) {
  if (typeof s !== 'string') return '';
  // Trim start
  let start = 0;
  let end = s.length - 1;
  while (start <= end && isWhitespace(s.charAt(start))) start += 1;
  while (end >= start && isWhitespace(s.charAt(end))) end -= 1;
  if (start > end) return '';

  let out = '';
  let inSpace = false;
  for (let i = start; i <= end; i += 1) {
    const ch = s.charAt(i);
    if (isWhitespace(ch)) {
      if (!inSpace) {
        out += ' ';
        inSpace = true;
      }
    } else {
      out += ch;
      inSpace = false;
    }
  }
  return out;
}

function isWhitespace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v';
}

function removeTrailingPunctuation(s) {
  if (typeof s !== 'string' || s.length === 0) return s;
  const last = s.charAt(s.length - 1);
  if (last === '.' || last === ',' || last === '!' || last === '?') return s.substring(0, s.length - 1);
  return s;
}

// Tokenize (after normalizeWhitespace) -> returns array of tokens (preserves punctuation in tokens)
function tokenizeNormalizedInstruction(normalized) {
  if (typeof normalized !== 'string' || normalized.length === 0) return [];
  // split on single space because normalizeWhitespace guarantees single spaces
  const raw = normalized.split(' ');
  const tokens = [];
  for (let i = 0; i < raw.length; i += 1) {
    const t = raw[i];
    if (t !== '') tokens.push(t);
  }
  return tokens;
}

module.exports = {
  // basic validators
  isPositiveIntegerString,
  isSupportedCurrency,
  isValidAccountId,
  isAllDigits,
  // date helpers
  parseUtcDateOnly,
  getTodayUtcDateValue,
  isLeapYear,
  getDaysInMonth,
  // whitespace & token helpers
  normalizeWhitespace,
  removeTrailingPunctuation,
  tokenizeNormalizedInstruction,
};
