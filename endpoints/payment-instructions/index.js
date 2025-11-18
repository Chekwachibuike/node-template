// endpoints/payment-instructions/process.js
const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const { parseAndProcessInstruction } = require('@app/services/payment-processor/parse-instruction');
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
 *             $ref: '#/components/schemas/PaymentInstructionRequest'
 *     responses:
 *       200:
 *         description: Payment instruction processed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentInstructionResponse'
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

      const result = await parseAndProcessInstruction({ accounts, instruction });
      
      return {
        status: helpers.http_statuses.HTTP_200_OK,
        data: result
      };
    } catch (error) {
      appLogger.errorX(error, 'payment-instruction-error');
      throw error;
    }
  }
});