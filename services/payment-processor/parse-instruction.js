// services/payment-processor/parse-instruction.js
const { appLogger } = require('@app-core/logger');
const PaymentMessages = require('@app/messages/payment') || require('@app/messages'); // adjust to your path

const {
  isPositiveIntegerString,
  isSupportedCurrency,
  isValidAccountId,
  parseUtcDateOnly,
  getTodayUtcDateValue,
  normalizeWhitespace,
  removeTrailingPunctuation,
  tokenizeNormalizedInstruction,
} = require('@app/services/utils/payment-instruction-helpers');


async function parseInstruction(serviceData = {}, options = {}) {
  // Default malformed SY03 response skeleton
  const makeSY03 = (reason) => ({
    type: null,
    amount: null,
    currency: null,
    debit_account: null,
    credit_account: null,
    execute_by: null,
    status: 'failed',
    status_reason: reason || PaymentMessages.MALFORMED_INSTRUCTION,
    status_code: 'SY03',
    accounts: [],
  });
  
  // Helper for malformed instruction (SY01)
  const makeSY01 = (reason) => ({
    type: null,
    amount: null,
    currency: null,
    debit_account: null,
    credit_account: null,
    execute_by: null,
    status: 'failed',
    status_reason: reason || PaymentMessages.MISSING_KEYWORD,
    status_code: 'SY01',
    accounts: [],
  });

  // 1) minimal shape check per spec: accounts must be array, instruction string
  if (!Array.isArray(serviceData.accounts) || typeof serviceData.instruction !== 'string') {
    return makeSY03(PaymentMessages.MALFORMED_INSTRUCTION);
  }

  // normalize whitespace; tokenise
  const normalized = normalizeWhitespace(serviceData.instruction);
  const tokens = tokenizeNormalizedInstruction(normalized);
  const upperTokens = tokens.map((t) => (typeof t === 'string' ? t.toUpperCase() : t));

  if (!tokens || tokens.length === 0) return makeSY03(PaymentMessages.MALFORMED_INSTRUCTION);

  // first token must be DEBIT or CREDIT
  const first = upperTokens[0];
  if (first !== 'DEBIT' && first !== 'CREDIT') {
    // For malformed instructions that don't start with DEBIT/CREDIT
    if (first === 'SEND' || first === 'TRANSFER') {
      return makeSY01(PaymentMessages.MISSING_KEYWORD);
    }
    return makeSY03(PaymentMessages.MALFORMED_INSTRUCTION);
  }

  const type = first; // "DEBIT" or "CREDIT"
  const tokenCount = tokens.length;
  const hasDateClause = tokenCount === 13;
  const noDateClause = tokenCount === 11;

  // Missing required keywords (SY01) if too short
  if (tokenCount < 11) {
    return {
      type: null,
      amount: null,
      currency: null,
      debit_account: null,
      credit_account: null,
      execute_by: null,
      status: 'failed',
      status_reason: PaymentMessages.MISSING_KEYWORD,
      status_code: 'SY01',
      accounts: [],
    };
  }

  // Not matching expected token lengths indicates invalid order (SY02)
  if (!noDateClause && !hasDateClause) {
    return {
      type,
      amount: null,
      currency: null,
      debit_account: null,
      credit_account: null,
      execute_by: null,
      status: 'failed',
      status_reason: PaymentMessages.INVALID_KEYWORD_ORDER,
      status_code: 'SY02',
      accounts: [],
    };
  }

  // If date clause present token 11 must be ON
  if (hasDateClause && upperTokens[11] !== 'ON') {
    return {
      type,
      amount: null,
      currency: null,
      debit_account: null,
      credit_account: null,
      execute_by: null,
      status: 'failed',
      status_reason: PaymentMessages.INVALID_KEYWORD_ORDER,
      status_code: 'SY02',
      accounts: [],
    };
  }

  // Extract according to type, but detect missing vs wrong keywords carefully
  let amountToken = null;
  let currencyToken = null;
  let debitAccountId = null;
  let creditAccountId = null;
  let dateToken = null;

  if (type === 'DEBIT') {
    // positions must exist
    // check undefined positions -> SY01
    if (tokens[3] === undefined || tokens[4] === undefined || tokens[5] === undefined
      || tokens[6] === undefined || tokens[7] === undefined || tokens[8] === undefined
      || tokens[9] === undefined || tokens[10] === undefined) {
      return {
        type,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        status: 'failed',
        status_reason: PaymentMessages.MISSING_KEYWORD,
        status_code: 'SY01',
        accounts: [],
      };
    }

    // Now check exact keyword text (if wrong -> SY02)
    if (upperTokens[3] !== 'FROM' || upperTokens[4] !== 'ACCOUNT'
      || upperTokens[6] !== 'FOR' || upperTokens[7] !== 'CREDIT'
      || upperTokens[8] !== 'TO' || upperTokens[9] !== 'ACCOUNT') {
      return {
        type,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        status: 'failed',
        status_reason: PaymentMessages.INVALID_KEYWORD_ORDER,
        status_code: 'SY02',
        accounts: [],
      };
    }

    amountToken = tokens[1];
    currencyToken = tokens[2];
    debitAccountId = removeTrailingPunctuation(tokens[5]);
    creditAccountId = removeTrailingPunctuation(tokens[10]);
    if (hasDateClause) dateToken = removeTrailingPunctuation(tokens[12]);
  } else {
    // CREDIT
    if (tokens[3] === undefined || tokens[4] === undefined || tokens[5] === undefined
      || tokens[6] === undefined || tokens[7] === undefined || tokens[8] === undefined
      || tokens[9] === undefined || tokens[10] === undefined) {
      return {
        type,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        status: 'failed',
        status_reason: PaymentMessages.MISSING_KEYWORD,
        status_code: 'SY01',
        accounts: [],
      };
    }

    if (upperTokens[3] !== 'TO' || upperTokens[4] !== 'ACCOUNT'
      || upperTokens[6] !== 'FOR' || upperTokens[7] !== 'DEBIT'
      || upperTokens[8] !== 'FROM' || upperTokens[9] !== 'ACCOUNT') {
      return {
        type,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        status: 'failed',
        status_reason: PaymentMessages.INVALID_KEYWORD_ORDER,
        status_code: 'SY02',
        accounts: [],
      };
    }

    amountToken = tokens[1];
    currencyToken = tokens[2];
    creditAccountId = removeTrailingPunctuation(tokens[5]);
    debitAccountId = removeTrailingPunctuation(tokens[10]);
    if (hasDateClause) dateToken = removeTrailingPunctuation(tokens[12]);
  }

  // ---------- Field validations (precedence)
  // AM02: Check for decimal amounts first
  if (typeof amountToken === 'string' && amountToken.includes('.')) {
    const num = Number(amountToken);
    if (!Number.isNaN(num) && num > 0) {
      return {
        type,
        amount: null,
        currency: null,
        debit_account: debitAccountId || null,
        credit_account: creditAccountId || null,
        execute_by: dateToken || null,
        status: 'failed',
        status_reason: 'Amount must be a whole number',
        status_code: 'AM02',
        accounts: [],
      };
    }
  }

  // AM01: amount must be positive integer
  if (!isPositiveIntegerString(amountToken)) {
    return {
      type,
      amount: null,
      currency: null,
      debit_account: debitAccountId || null,
      credit_account: creditAccountId || null,
      execute_by: dateToken || null,
      status: 'failed',
      status_reason: 'Amount must be a positive integer',
      status_code: 'AM01',
      accounts: [],
    };
  }
  
  const amount = parseInt(amountToken, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      type,
      amount: null,
      currency: null,
      debit_account: debitAccountId || null,
      credit_account: creditAccountId || null,
      execute_by: dateToken || null,
      status: 'failed',
      status_reason: 'Amount must be a positive integer',
      status_code: 'AM01',
      accounts: [],
    };
  }

  // CU02: supported currency
  const currencyUpper = currencyToken ? currencyToken.toUpperCase() : null;
  if (!currencyUpper || !isSupportedCurrency(currencyUpper)) {
    // return accounts unchanged if possible (spec examples show accounts included when currencies provided)
    return {
      type,
      amount,
      currency: currencyUpper || null,
      debit_account: debitAccountId || null,
      credit_account: creditAccountId || null,
      execute_by: dateToken || null,
      status: 'failed',
      status_reason: 'Unsupported currency. Only NGN, USD, GBP, and GHS are supported',
      status_code: 'CU02',
      accounts: [],
    };
  }

  // AC04: account id character validation
  if (!isValidAccountId(debitAccountId) || !isValidAccountId(creditAccountId)) {
    return {
      type,
      amount,
      currency: currencyUpper,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: dateToken || null,
      status: 'failed',
      status_reason: 'Invalid account ID format',
      status_code: 'AC04',
      accounts: [],
    };
  }

  // AC03: account existence - preserve input order for returned accounts
  const providedAccounts = serviceData.accounts || [];
  const involved = [];
  let foundDebit = null;
  let foundCredit = null;
  for (let i = 0; i < providedAccounts.length; i += 1) {
    const a = providedAccounts[i];
    if (!a || typeof a.id !== 'string') continue;
    if (a.id === debitAccountId || a.id === creditAccountId) {
      // push a shallow copy; we'll set balances later
      involved.push({
        id: a.id,
        balance: a.balance,
        balance_before: a.balance,
        currency: String(a.currency || '').toUpperCase(),
      });
    }
    if (a.id === debitAccountId) foundDebit = a;
    if (a.id === creditAccountId) foundCredit = a;
  }

  if (!foundDebit || !foundCredit) {
    return {
      type,
      amount,
      currency: currencyUpper,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: dateToken || null,
      status: 'failed',
      status_reason: 'Account not found',
      status_code: 'AC03',
      accounts: involved,
    };
  }

  // CU01: currencies must match between accounts and match instruction currency
  const debitCurrency = String(foundDebit.currency || '').toUpperCase();
  const creditCurrency = String(foundCredit.currency || '').toUpperCase();
  if (debitCurrency !== creditCurrency || debitCurrency !== currencyUpper) {
    return {
      type,
      amount,
      currency: currencyUpper,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: dateToken || null,
      status: 'failed',
      status_reason: 'Account currency mismatch',
      status_code: 'CU01',
      accounts: involved,
    };
  }

  // AC02: debit and credit must differ
  if (debitAccountId === creditAccountId) {
    return {
      type,
      amount,
      currency: currencyUpper,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: dateToken || null,
      status: 'failed',
      status_reason: 'Debit and credit accounts cannot be the same',
      status_code: 'AC02',
      accounts: involved,
    };
  }

  // AC01: sufficient funds in debit account
  if (typeof foundDebit.balance !== 'number' || foundDebit.balance < amount) {
    return {
      type,
      amount,
      currency: currencyUpper,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by: dateToken || null,
      status: 'failed',
      status_reason: `Insufficient funds in debit account ${debitAccountId}: has ${foundDebit.balance} ${debitCurrency}, needs ${amount} ${debitCurrency}`,
      status_code: 'AC01',
      accounts: involved,
    };
  }

  // DT01: date format
  let execute_by = null;
  let isPending = false;
  if (dateToken) {
    const parsed = parseUtcDateOnly(dateToken);
    if (!parsed || !parsed.isValid) {
      return {
        type,
        amount,
        currency: currencyUpper,
        debit_account: debitAccountId,
        credit_account: creditAccountId,
        execute_by: dateToken,
        status: 'failed',
        status_reason: 'Invalid date format',
        status_code: 'DT01',
        accounts: involved,
      };
    }
    execute_by = dateToken;
    const todayVal = getTodayUtcDateValue();
    if (parsed.value > todayVal) {
      isPending = true;
    }
  }

  // Build accounts result: apply balances only if immediate execution
  const resultAccounts = [];
  for (let i = 0; i < involved.length; i += 1) {
    const a = {
      id: involved[i].id,
      balance_before: involved[i].balance_before,
      balance: involved[i].balance, // may be modified
      currency: String(involved[i].currency || '').toUpperCase(),
    };
    if (!isPending) {
      if (a.id === debitAccountId && a.id !== creditAccountId) {
        a.balance = a.balance - amount;
      } else if (a.id === creditAccountId && a.id !== debitAccountId) {
        a.balance = a.balance + amount;
      } // if same id both debit and credit, handled earlier AC02
    }
    resultAccounts.push(a);
  }

  // Final responses
  if (isPending) {
    return {
      type,
      amount,
      currency: currencyUpper,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      execute_by,
      status: 'pending',
      status_reason: 'Transaction scheduled for future execution',
      status_code: 'AP01',
      accounts: resultAccounts,
    };
  }

  // Successful execution
  return {
    type,
    amount,
    currency: currencyUpper,
    debit_account: debitAccountId,
    credit_account: creditAccountId,
    execute_by: execute_by || null,
    status: 'successful',
    status_reason: 'Transaction executed successfully',
    status_code: 'AP00',
    accounts: resultAccounts,
  };
}

module.exports = parseInstruction;
