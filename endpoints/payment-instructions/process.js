const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const parseInstruction = require('../../services/payment-processor/parse-instruction');

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
 * Process payment instruction endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
module.exports = async function processPaymentInstruction(req, res) {
  try {
    // 1. Validate request body structure
    let requestData;
    try {
      requestData = validator.validate(req.body, parsedRequestSpec);
    } catch (validationError) {
      return res.status(400).json({
        type: null,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        status: 'failed',
        status_reason: 'Invalid request format: ' + validationError.message,
        status_code: 'SY03',
        accounts: []
      });
    }

    // 2. Call the service layer to parse + execute
    const response = await parseInstruction(requestData);

    // 3. Return the response from service
    return res.status(200).json(response);

  } catch (error) {
    // Log the error using the project's logger
    appLogger.errorX(error, 'process-instruction-endpoint-error');

    // Handle validation errors from service
    if (error.isAppError) {
      return res.status(200).json({
        type: null,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        status: 'failed',
        status_reason: error.message,
        status_code: error.code || 'APPERR',
        accounts: []
      });
    }

    // Handle unexpected errors
    return res.status(500).json({
      type: null,
      amount: null,
      currency: null,
      debit_account: null,
      credit_account: null,
      execute_by: null,
      status: 'failed',
      status_reason: 'Internal server error',
      status_code: 'APPERR',
      accounts: []
    });
  }
};