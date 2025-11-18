// deploy-server.js
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const paymentInstructionEndpoint = require('./endpoints/payment-instructions');

const app = express();
app.use(express.json());

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Payment Instructions API',
      version: '1.0.0',
      description: 'API for processing payment instructions',
    },
  },
  apis: ['./endpoints/payment-instructions/index.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Register the payment instruction endpoint
const handler = paymentInstructionEndpoint.handler;
app.post(paymentInstructionEndpoint.path, async (req, res) => {
  try {
    const result = await handler({
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers
    }, {
      http_statuses: {
        HTTP_200_OK: 200,
        HTTP_400_BAD_REQUEST: 400
      }
    });
    res.status(200).json(result.data);
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
      ...(error.status_code && { status_code: error.status_code }),
      ...(error.status_reason && { status_reason: error.status_reason })
    });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Payment Instructions API is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Payment API running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
});