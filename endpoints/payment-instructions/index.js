// endpoints/payment-instructions/index.js
const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const processPaymentInstruction = require('./process');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');

/**
 * @swagger
 * /payment-instructions:
 *   post:
 *     summary: Process a payment instruction
 *     description: Parse and execute a payment instruction between accounts
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accounts
 *               - instruction
 *             example:
 *               accounts:
 *                 - id: "a"
 *                   balance: 500
 *                   currency: "USD"
 *                 - id: "b"
 *                   balance: 200
 *                   currency: "USD"
 *               instruction: "SEND 100 USD TO ACCOUNT b"
 *             properties:
 *               accounts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - balance
 *                     - currency
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Unique identifier for the account
 *                     balance:
 *                       type: number
 *                       format: float
 *                       description: Current balance of the account
 *                     currency:
 *                       type: string
 *                       description: Currency code (e.g., USD, EUR, GBP)
 *               instruction:
 *                 type: string
 *                 description: Payment instruction in natural language
 *                 example: "SEND 100 USD TO ACCOUNT b"
 *     responses:
 *       200:
 *         description: Payment instruction processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "COMPLETED"
 *                     status_code:
 *                       type: string
 *                       example: "00"
 *                     status_reason:
 *                       type: string
 *                       example: "Transaction successful"
 *                     type:
 *                       type: string
 *                       example: "DEBIT"
 *                     amount:
 *                       type: number
 *                       example: 100
 *                     currency:
 *                       type: string
 *                       example: "USD"
 *                     debit_account:
 *                       type: string
 *                       example: "a"
 *                     credit_account:
 *                       type: string
 *                       example: "b"
 *                     execute_by:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-11-18T18:00:00.000Z"
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Invalid request: accounts and instruction are required"
 *                 status_code:
 *                   type: string
 *                   example: "96"
 *                 status_reason:
 *                   type: string
 *                   example: "Invalid request data"
 */
module.exports = createHandler({
  path: '/payment-instructions',
  method: 'post',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info({ requestContext: rc, response: rs }, 'payment-instruction-request-completed');
  },
  async handler(rc, helpers) {
    try {
      const { accounts, instruction } = rc.body;
      
      if (!accounts || !Array.isArray(accounts) || !instruction) {
        throwAppError('Invalid request: accounts and instruction are required', ERROR_CODE.INVLDDATA);
      }

      const result = await processPaymentInstruction({ accounts, instruction });
      
      // Return the result directly in the expected format (raw = true to bypass framework wrapper)
      return {
        status: helpers.http_statuses.HTTP_200_OK,
        raw: true,
        data: result
      };
    } catch (error) {
      appLogger.errorX(error, 'payment-instruction-error');
      
      // For unhandled errors, return SY03 format (raw = true to bypass framework wrapper)
      return {
        status: helpers.http_statuses.HTTP_200_OK,
        raw: true,
        data: {
          type: null,
          amount: null,
          currency: null,
          debit_account: null,
          credit_account: null,
          execute_by: null,
          status: 'failed',
          status_reason: error.message || 'Malformed instruction: unable to parse keywords',
          status_code: 'SY03',
          accounts: []
        }
      };
    }
  }
});