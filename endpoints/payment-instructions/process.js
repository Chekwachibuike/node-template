const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const parseInstruction = require('../../services/payment-processor/parse-instruction');
const PaymentMessages = require('@app/messages/payment') || require('@app/messages');

// Validation spec for the request body
const requestSpec = `root {
  accounts[] {
    id string
    balance number
    currency string
  }
  instruction string
}`;

// Parse the spec once when the module loads
const parsedRequestSpec = validator.parse(requestSpec);

/**
 * Process payment instruction
 * @param {Object} params - The request parameters
 * @param {Array} params.accounts - Array of account objects
 * @param {string} params.instruction - The payment instruction
 * @returns {Promise<Object>} The result of the payment instruction
 */
async function processPaymentInstruction({ accounts, instruction }) {
  try {
    // 1. Validate request body structure
    validator.validate({ accounts, instruction }, parsedRequestSpec);
    
    // 2. Parse the instruction - it handles all validation and returns the complete response
    const result = await parseInstruction({ accounts, instruction });
    
    // 3. For error cases where accounts are missing but account IDs are present,
    //    we need to include the accounts with unchanged balances
    if (result.status === 'failed' && result.accounts.length === 0 
        && result.debit_account && result.credit_account) {
      const debitAccount = accounts.find(acc => acc.id === result.debit_account);
      const creditAccount = accounts.find(acc => acc.id === result.credit_account);
      
      if (debitAccount && creditAccount) {
        result.accounts = [
          {
            id: debitAccount.id,
            balance: debitAccount.balance,
            balance_before: debitAccount.balance,
            currency: debitAccount.currency
          },
          {
            id: creditAccount.id,
            balance: creditAccount.balance,
            balance_before: creditAccount.balance,
            currency: creditAccount.currency
          }
        ];
      }
    }
    
    return result;
  } catch (error) {
    appLogger.errorX(error, 'payment-instruction-error');
    
    // For validation errors from the validator, return SY03 error
    return {
      type: null,
      amount: null,
      currency: null,
      debit_account: null,
      credit_account: null,
      execute_by: null,
      status: 'failed',
      status_reason: error.message || PaymentMessages.MALFORMED_INSTRUCTION || 'Malformed instruction: unable to parse keywords',
      status_code: 'SY03',
      accounts: []
    };
  }
}

module.exports = processPaymentInstruction;