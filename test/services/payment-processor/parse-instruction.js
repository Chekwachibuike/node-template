// test/services/payment-processor/parse-instruction.test.js
const { expect } = require('chai');
const parseInstruction = require('../../../services/payment-processor/parse-instruction');

describe('Payment Instruction Processor', function() {
  describe('Valid Test Cases', function() {
    it('TC1: Should process valid DEBIT format', async function() {
      const result = await parseInstruction({
        accounts: [
          { id: "N90394", balance: 1000, currency: "USD" },
          { id: "N9122", balance: 500, currency: "USD" }
        ],
        instruction: "DEBIT 500 USD FROM ACCOUNT N90394 FOR CREDIT TO ACCOUNT N9122"
      });

      expect(result).to.include({
        status: 'successful',
        status_code: 'AP00',
        amount: 500,
        currency: 'USD',
        debit_account: 'N90394',
        credit_account: 'N9122'
      });
      expect(result.accounts[0].balance).to.equal(500); // 1000 - 500
      expect(result.accounts[1].balance).to.equal(1000); // 500 + 500
    });

    it('TC2: Should handle CREDIT format with future date', async function() {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const result = await parseInstruction({
        accounts: [
          { id: "acc-001", balance: 1000, currency: "NGN" },
          { id: "acc-002", balance: 500, currency: "NGN" }
        ],
        instruction: `CREDIT 300 NGN TO ACCOUNT acc-002 FOR DEBIT FROM ACCOUNT acc-001 ON ${futureDateStr}`
      });

      expect(result).to.include({
        status: 'pending',
        status_code: 'AP01',
        amount: 300,
        currency: 'NGN',
        debit_account: 'acc-001',
        credit_account: 'acc-002',
        execute_by: futureDateStr
      });
      // Balances should remain unchanged for future-dated transactions
      expect(result.accounts[0].balance).to.equal(1000);
      expect(result.accounts[1].balance).to.equal(500);
    });

    it('TC3: Should handle case-insensitive keywords', async function() {
      const result = await parseInstruction({
        accounts: [
          { id: "a", balance: 500, currency: "GBP" },
          { id: "b", balance: 200, currency: "GBP" }
        ],
        instruction: "debit 100 gbp from account a for credit to account b"
      });

      expect(result).to.include({
        status: 'successful',
        status_code: 'AP00',
        amount: 100,
        currency: 'GBP',
        debit_account: 'a',
        credit_account: 'b'
      });
    });

    it('TC4: Should execute immediately for past dates', async function() {
      const result = await parseInstruction({
        accounts: [
          { id: "x", balance: 500, currency: "NGN" },
          { id: "y", balance: 200, currency: "NGN" }
        ],
        instruction: "DEBIT 100 NGN FROM ACCOUNT x FOR CREDIT TO ACCOUNT y ON 2024-01-15"
      });

      expect(result).to.include({
        status: 'successful',
        status_code: 'AP00'
      });
    });
  });

  describe('Invalid Test Cases', function() {
    it('TC5: Should reject currency mismatch', async function() {
      const result = await parseInstruction({
        accounts: [
          { id: "a", balance: 100, currency: "USD" },
          { id: "b", balance: 500, currency: "GBP" }
        ],
        instruction: "DEBIT 50 USD FROM ACCOUNT a FOR CREDIT TO ACCOUNT b"
      });
      expect(result.status_code).to.equal('CU01');
      expect(result.status).to.equal('failed');
    });

    it('TC6: Should reject insufficient funds', async function() {
      const result = await parseInstruction({
        accounts: [
          { id: "a", balance: 10, currency: "USD" },
          { id: "b", balance: 0, currency: "USD" }
        ],
        instruction: "DEBIT 50 USD FROM ACCOUNT a FOR CREDIT TO ACCOUNT b"
      });
      expect(result.status_code).to.equal('AC01');
      expect(result.status).to.equal('failed');
    });

    it('TC7: Should reject unsupported currency', async function() {
      const result = await parseInstruction({
        accounts: [
          { id: "a", balance: 100, currency: "USD" },
          { id: "b", balance: 0, currency: "USD" }
        ],
        instruction: "DEBIT 50 XYZ FROM ACCOUNT a FOR CREDIT TO ACCOUNT b"
      });
      expect(result.status_code).to.equal('CU02');
      expect(result.status).to.equal('failed');
    });

    it('TC8: Should reject same account for debit and credit', async function() {
      const result = await parseInstruction({
        accounts: [
          { id: "a", balance: 500, currency: "USD" }
        ],
        instruction: "DEBIT 100 USD FROM ACCOUNT a FOR CREDIT TO ACCOUNT a"
      });
      expect(result.status_code).to.equal('AC02');
      expect(result.status).to.equal('failed');
    });

    it('TC9: Should reject negative amount', async function() {
      const result = await parseInstruction({
        accounts: [
          { id: "a", balance: 500, currency: "USD" },
          { id: "b", balance: 0, currency: "USD" }
        ],
        instruction: "DEBIT -100 USD FROM ACCOUNT a FOR CREDIT TO ACCOUNT b"
      });
      expect(result.status_code).to.equal('AM01');
      expect(result.status).to.equal('failed');
    });

    it('TC10: Should reject if account not found', async function() {
      const result = await parseInstruction({
        accounts: [
          { id: "a", balance: 500, currency: "USD" }
          // Missing account b
        ],
        instruction: "DEBIT 100 USD FROM ACCOUNT a FOR CREDIT TO ACCOUNT b"
      });
      expect(result.status_code).to.equal('AC03');
      expect(result.status).to.equal('failed');
    });

    it('TC11: Should reject decimal amount', async function() {
      const result = await parseInstruction({
        accounts: [
          { id: "a", balance: 500, currency: "USD" },
          { id: "b", balance: 0, currency: "USD" }
        ],
        instruction: "DEBIT 100.50 USD FROM ACCOUNT a FOR CREDIT TO ACCOUNT b"
      });
      expect(result.status_code).to.equal('AM02');
      expect(result.status).to.equal('failed');
    });

    it('TC12: Should reject malformed instruction', async function() {
      const result = await parseInstruction({
        accounts: [
          { id: "a", balance: 500, currency: "USD" },
          { id: "b", balance: 200, currency: "USD" }
        ],
        instruction: "SEND 100 USD TO ACCOUNT b"
      });
      expect(['SY01', 'SY03']).to.include(result.status_code);
      expect(result.status).to.equal('failed');
    });
  });
});