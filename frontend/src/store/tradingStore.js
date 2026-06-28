import { create } from 'zustand';

const API_URL = 'http://localhost:5000';

export const useTradingStore = create((set, get) => ({
  role: null, // 'BUYER' | 'SELLER' | 'MM' | 'AUDITOR'
  intents: [],
  proposals: [],
  buyerAccepted: [],
  settlements: [],
  holdings: [],
  rfqs: [],
  quotes: [],
  auditRecords: [],
  isLoading: false,
  error: null,

  setRole: (role) => set({ role }),

  fetchData: async (partyName, jwt) => {
    if (!partyName || !jwt) return;
    set({ isLoading: true, error: null });
    
    try {
      // 1. Fetch holdings
      const holdingsRes = await fetch(`${API_URL}/api/holdings?party=${partyName}`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      const holdings = holdingsRes.ok ? await holdingsRes.json() : [];

      // 2. Fetch intents
      const intentsRes = await fetch(`${API_URL}/api/intents?party=${partyName}`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      const intents = intentsRes.ok ? await intentsRes.json() : [];

      // 3. Fetch proposals
      const propRes = await fetch(`${API_URL}/api/proposals?party=${partyName}`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      const propData = propRes.ok ? await propRes.json() : { proposals: [], buyerAccepted: [] };

      // 4. Fetch settlements
      const settleRes = await fetch(`${API_URL}/api/settlements?party=${partyName}`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      const settlements = settleRes.ok ? await settleRes.json() : [];

      // 5. Fetch RFQs & Quotes
      const rfqRes = await fetch(`${API_URL}/api/rfqs?party=${partyName}`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      const rfqData = rfqRes.ok ? await rfqRes.json() : { rfqs: [], quotes: [] };

      // 6. Fetch Audit Records (Carol / Auditor only)
      let auditRecords = [];
      if (partyName === 'Carol' || partyName.includes('party-81b0') || partyName.includes('Carol')) {
        const auditRes = await fetch(`${API_URL}/api/audit-records?party=${partyName}`, {
          headers: { 'Authorization': `Bearer ${jwt}` }
        });
        auditRecords = auditRes.ok ? await auditRes.json() : [];
      }

      set({
        holdings,
        intents,
        proposals: propData.proposals || [],
        buyerAccepted: propData.buyerAccepted || [],
        settlements,
        rfqs: rfqData.rfqs || [],
        quotes: rfqData.quotes || [],
        auditRecords,
        isLoading: false
      });
    } catch (err) {
      console.error('[TradingStore] Fetch error:', err.message);
      set({ error: err.message, isLoading: false });
    }
  },

  postIntent: async (trader, asset, side, quantity, price, expirySecs, jwt) => {
    try {
      const res = await fetch(`${API_URL}/api/intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ trader, asset, side, quantity, price, expirySecs })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      return true;
    } catch (err) {
      console.error('[TradingStore] Post intent failed:', err.message);
      throw err;
    }
  },

  acceptProposal: async (party, proposalId, role, jwt) => {
    try {
      const res = await fetch(`${API_URL}/api/proposals/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ party, proposalId, role })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      return true;
    } catch (err) {
      console.error('[TradingStore] Accept proposal failed:', err.message);
      throw err;
    }
  },

  executeSettlement: async (party, settlementId, buyerHoldingId, sellerHoldingId, jwt) => {
    try {
      const res = await fetch(`${API_URL}/api/settlements/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ party, settlementId, buyerHoldingId, sellerHoldingId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      return true;
    } catch (err) {
      console.error('[TradingStore] Settle failed:', err.message);
      throw err;
    }
  },

  mintHolding: async (owner, instrument, amount, jwt) => {
    try {
      const res = await fetch(`${API_URL}/api/holdings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ owner, instrument, amount })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      return true;
    } catch (err) {
      console.error('[TradingStore] Faucet mint failed:', err.message);
      throw err;
    }
  },

  submitQuote: async (marketMaker, rfqId, quotePrice, jwt) => {
    try {
      const res = await fetch(`${API_URL}/api/quotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ marketMaker, rfqId, quotePrice })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      return true;
    } catch (err) {
      console.error('[TradingStore] Quote submit failed:', err.message);
      throw err;
    }
  },

  acceptQuote: async (trader, quoteId, jwt) => {
    try {
      const res = await fetch(`${API_URL}/api/quotes/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ trader, quoteId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      return true;
    } catch (err) {
      console.error('[TradingStore] Accept quote failed:', err.message);
      throw err;
    }
  }
}));
