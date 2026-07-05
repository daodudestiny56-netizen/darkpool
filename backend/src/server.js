import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import { partyMap, resolveParties, allocateParty, generateToken } from './parties.js';
import { createContract, queryContracts, exerciseChoice } from './ledger.js';
import { runMatcher } from './matcher.js';
import { checkExpiries } from './expiry-monitor.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Broadcast helper for WebSockets
function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

// ---------------- REST API ENDPOINTS ----------------

// Get parties mapping
app.get('/api/parties', (req, res) => {
  res.json(partyMap);
});

// Auth endpoint to resolve wallet address to Canton party ID
app.post('/api/auth/wallet', async (req, res) => {
  const { address } = req.body;
  
  try {
    let resolvedPartyId = '';
    const addressLower = address.toLowerCase();
    
    if (addressLower.includes('alice')) {
      resolvedPartyId = partyMap.Alice;
    } else if (addressLower.includes('bob')) {
      resolvedPartyId = partyMap.Bob;
    } else if (addressLower.includes('carol') || addressLower.includes('regulator')) {
      resolvedPartyId = partyMap.Carol;
    } else if (addressLower.includes('market') || addressLower.includes('mm') || addressLower.includes('maker')) {
      resolvedPartyId = partyMap.MarketMaker;
    } else {
      // Check if display name already matches in the allocated parties list
      const tempToken = generateToken('MatchEngine');
      const partiesRes = await fetch(`${process.env.JSON_API_URL || 'http://localhost:7575'}/v1/parties`, {
        headers: {
          'Authorization': `Bearer ${tempToken}`
        }
      });
      if (partiesRes.ok) {
        const data = await partiesRes.json();
        const existing = data.result?.find(p => p.displayName === address);
        if (existing) {
          resolvedPartyId = existing.identifier;
        }
      }
      
      // If not allocated, allocate dynamically!
      if (!resolvedPartyId) {
        console.log(`[Auth] Allocating new party for address: ${address}`);
        resolvedPartyId = await allocateParty(process.env.JSON_API_URL || 'http://localhost:7575', address);
      }
    }
    
    const token = generateToken(resolvedPartyId);
    res.json({
      partyId: resolvedPartyId,
      token: token
    });
  } catch (err) {
    console.error('[Auth] Error in wallet resolution:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Post a new TradeIntent
app.post('/api/intents', async (req, res) => {
  const { trader, asset, side, quantity, price, expirySecs } = req.body;
  
  const matcherParty = partyMap.MatchEngine;
  const traderParty = partyMap[trader];
  
  if (!traderParty) {
    return res.status(400).json({ error: `Invalid trader name: ${trader}` });
  }
  
  const expiryTime = new Date(Date.now() + parseInt(expirySecs) * 1000).toISOString();
  
  try {
    const contract = await createContract(traderParty, 'TradeIntent:TradeIntent', {
      trader: traderParty,
      matcher: matcherParty,
      asset,
      side,
      quantity: parseFloat(quantity).toString(),
      price: parseFloat(price).toString(),
      expiry: expiryTime,
      status: 'ACTIVE'
    });
    
    console.log(`[API] Intent created for ${trader}:`, contract.contractId);
    broadcast({ type: 'INTENT_CREATED', party: trader, side, asset, contract });
    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query TradeIntents
app.get('/api/intents', async (req, res) => {
  const { party } = req.query;
  const partyId = partyMap[party] || party;
  
  try {
    const contracts = await queryContracts(partyId, 'TradeIntent:TradeIntent');
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query Holdings
app.get('/api/holdings', async (req, res) => {
  const { party } = req.query;
  const partyId = partyMap[party] || party;
  
  try {
    const contracts = await queryContracts(partyId, 'Daml.Finance.Interface.Holding.Base:Holding');
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mint holding (USD or BTC)
app.post('/api/holdings', async (req, res) => {
  const { owner, instrument, amount } = req.body;
  const ownerParty = partyMap[owner] || owner;
  const custodianParty = partyMap.Custodian;
  
  try {
    const contract = await createContract(ownerParty, 'Daml.Finance.Interface.Holding.Base:Holding', {
      owner: ownerParty,
      custodian: custodianParty,
      instrument,
      amount: parseFloat(amount).toString()
    });
    
    console.log(`[API] Holding minted for ${owner}:`, contract.contractId);
    broadcast({ type: 'HOLDING_MINTED', party: owner, instrument, amount });
    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query MatchProposals
app.get('/api/proposals', async (req, res) => {
  const { party } = req.query;
  const partyId = partyMap[party] || party;
  
  try {
    const proposals = await queryContracts(partyId, 'MatchProposal:MatchProposal');
    const buyerAccepted = await queryContracts(partyId, 'MatchProposal:BuyerAcceptedMatch');
    res.json({ proposals, buyerAccepted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept MatchProposal
app.post('/api/proposals/accept', async (req, res) => {
  const { party, proposalId, role } = req.body;
  const partyId = partyMap[party] || party;
  const regulator = partyMap.Carol;
  
  try {
    let result;
    if (role === 'buyer') {
      result = await exerciseChoice(partyId, 'MatchProposal:MatchProposal', proposalId, 'AcceptByBuyer');
      console.log(`[API] Buyer ${party} accepted MatchProposal:`, proposalId);
      broadcast({ type: 'PROPOSAL_ACCEPTED_BUYER', proposalId, party });
    } else {
      result = await exerciseChoice(partyId, 'MatchProposal:BuyerAcceptedMatch', proposalId, 'AcceptBySeller', {
        regulator
      });
      console.log(`[API] Seller ${party} accepted MatchProposal:`, proposalId);
      broadcast({ type: 'PROPOSAL_ACCEPTED_SELLER', proposalId, party });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settle AtomicSettlement
app.post('/api/settlements/execute', async (req, res) => {
  const { party, settlementId, buyerHoldingId, sellerHoldingId } = req.body;
  const partyId = partyMap[party] || party;
  
  try {
    // 1. Query the settlement contract to get buyer and seller party IDs
    const settlements = await queryContracts(partyId, 'AtomicSettlement:AtomicSettlement');
    const settlement = settlements.find(s => s.contractId === settlementId);
    if (!settlement) {
      return res.status(404).json({ error: `Settlement contract not found: ${settlementId}` });
    }
    
    const { buyer, seller } = settlement.payload;
    
    // 2. Exercise Settle choice using the co-signed authority of BOTH buyer and seller
    const result = await exerciseChoice([buyer, seller], 'AtomicSettlement:AtomicSettlement', settlementId, 'Settle', {
      buyerHoldingId,
      sellerHoldingId
    });
    
    console.log(`[API] Atomic settlement executed cooperatively for ${party}:`, settlementId);
    broadcast({ type: 'SETTLEMENT_EXECUTED', settlementId, party });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query settlements
app.get('/api/settlements', async (req, res) => {
  const { party } = req.query;
  const partyId = partyMap[party] || party;
  
  try {
    const contracts = await queryContracts(partyId, 'AtomicSettlement:AtomicSettlement');
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get AuditRecords (Carol the Auditor and Traders)
app.get('/api/audit-records', async (req, res) => {
  const { party } = req.query;
  const partyId = partyMap[party] || party;
  
  try {
    const records = await queryContracts(partyId, 'AuditRecord:AuditRecord');
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query RFQs (Market Maker / Trader)
app.get('/api/rfqs', async (req, res) => {
  const { party } = req.query;
  const partyId = partyMap[party] || party;
  
  try {
    const rfqs = await queryContracts(partyId, 'RFQ:RFQBroadcast');
    const quotes = await queryContracts(partyId, 'RFQ:MarketMakerQuote');
    res.json({ rfqs, quotes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Market Maker Quote on RFQ
app.post('/api/quotes', async (req, res) => {
  const { marketMaker, rfqId, quotePrice } = req.body;
  const mmParty = partyMap[marketMaker] || marketMaker;
  
  try {
    const quote = await exerciseChoice(mmParty, 'RFQ:RFQBroadcast', rfqId, 'SubmitQuote', {
      marketMaker: mmParty,
      quotePrice: parseFloat(quotePrice).toString()
    });
    
    console.log(`[API] Market Maker ${marketMaker} submitted quote:`, quote.contractId);
    broadcast({ type: 'QUOTE_SUBMITTED', marketMaker, rfqId, quote });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept Market Maker Quote (Trader accepts MM quote)
app.post('/api/quotes/accept', async (req, res) => {
  const { trader, quoteId } = req.body;
  const traderParty = partyMap[trader] || trader;
  const regulator = partyMap.Carol;
  
  try {
    const settlement = await exerciseChoice(traderParty, 'RFQ:MarketMakerQuote', quoteId, 'AcceptQuote', {
      regulator
    });
    
    console.log(`[API] Trader ${trader} accepted Market Maker quote:`, quoteId);
    broadcast({ type: 'QUOTE_ACCEPTED', trader, quoteId });
    res.json(settlement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- BACKGROUND SERVICES ----------------

let isResolving = false;
async function startup() {
  if (isResolving) return;
  isResolving = true;
  
  console.log('[Startup] Resolving parties from Canton JSON API...');
  await resolveParties(process.env.JSON_API_URL || 'http://localhost:7575');
  isResolving = false;
}

// Start polling matching engine and expiry check
setInterval(async () => {
  // Try to resolve parties if not yet resolved
  if (Object.values(partyMap).every(v => v === '')) {
    await startup();
    return;
  }
  
  // Run Match Engine loop
  await runMatcher();
  
  // Run Expiry Graduation loop
  await checkExpiries((msg) => {
    broadcast(msg);
  });
}, 2000);

// WebSocket connection logs
wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

server.listen(port, async () => {
  console.log(`[Server] DarkPool.fi backend listening on port ${port}`);
  await startup();
});
