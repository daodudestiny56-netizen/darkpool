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

console.log('[CONFIG] CANTON_URL from env:', process.env.CANTON_URL);
if (!process.env.CANTON_URL) {
  throw new Error('CANTON_URL is not set — refusing to start');
}

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://darkpool-fi.vercel.app',
  'https://darkpoolfi.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
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


// ---------------- AUTHENTICATION MIDDLEWARE ----------------
import crypto from 'crypto';
import { JWT_SECRET } from './parties.js';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    // Verify signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    if (signature !== expectedSignature) {
      return res.status(403).json({ error: 'Invalid token signature' });
    }
    
    // Decode payload
    const payloadJson = Buffer.from(encodedPayload, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    const actAs = payload["https://daml.com/ledger-api"]?.actAs || [];
    req.userParty = actAs[0];
    if (!req.userParty) return res.status(401).json({ error: 'Invalid token payload' });
    
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token format' });
  }
}

function resolveParty(reqPartyName) {
  const mapped = partyMap[reqPartyName] || reqPartyName;
  if (!mapped.includes('::') && !reqPartyName.startsWith('0x')) {
    throw new Error('Ledger is still initializing. Please wait a moment and try again.');
  }
  return mapped;
}

function verifyParty(reqPartyName, actualPartyId) {
  const mapped = resolveParty(reqPartyName);
  
  if (mapped === actualPartyId) return mapped;
  
  if (reqPartyName.startsWith('0x') && actualPartyId.startsWith(reqPartyName + '::')) {
    partyMap[reqPartyName] = actualPartyId;
    return actualPartyId;
  }
  
  throw new Error('Unauthorized party impersonation for ' + reqPartyName);
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
      const partiesRes = await fetch(`${process.env.CANTON_URL}/v1/parties`, {
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
        resolvedPartyId = await allocateParty(process.env.CANTON_URL, address);
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
app.post('/api/intents', authenticateToken, async (req, res) => {
  const { trader, asset, side, quantity, price, expirySecs } = req.body;
  
  const matcherParty = partyMap.MatchEngine;
  
  const expiryTime = new Date(Date.now() + parseInt(expirySecs) * 1000).toISOString();
  
  try {
    const traderParty = verifyParty(trader, req.userParty);
    if (!traderParty) {
      return res.status(400).json({ error: `Invalid trader name: ${trader}` });
    }
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
app.get('/api/intents', authenticateToken, async (req, res) => {
  const { party } = req.query;
  
  try {
    const partyId = verifyParty(party, req.userParty);
    const contracts = await queryContracts(partyId, 'TradeIntent:TradeIntent');
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query Holdings
app.get('/api/holdings', authenticateToken, async (req, res) => {
  const { party } = req.query;
  
  try {
    const partyId = verifyParty(party, req.userParty);
    const contracts = await queryContracts(partyId, 'Daml.Finance.Interface.Holding.Base:Holding');
    console.log(`[API] /api/holdings called by ${party}. Resolved to ${partyId}. Found ${contracts.length} holdings.`);
    res.json(contracts);
  } catch (err) {
    console.error(`[API] /api/holdings ERROR for ${party}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Mint holding (USD or BTC)
app.post('/api/holdings', authenticateToken, async (req, res) => {
  const { owner, instrument, amount } = req.body;
  const custodianParty = partyMap.Custodian;
  
  if (!custodianParty.includes('::')) {
    return res.status(503).json({ error: 'Ledger is still initializing. Please wait a moment and try again.' });
  }
  
  try {
    const ownerParty = verifyParty(owner, req.userParty);
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
app.get('/api/proposals', authenticateToken, async (req, res) => {
  const { party } = req.query;
  try {
    const partyId = verifyParty(party, req.userParty);
    const proposals = await queryContracts(partyId, 'MatchProposal:MatchProposal');
    const buyerAccepted = await queryContracts(partyId, 'MatchProposal:BuyerAcceptedMatch');
    res.json({ proposals, buyerAccepted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept MatchProposal
app.post('/api/proposals/accept', authenticateToken, async (req, res) => {
  const { party, proposalId, role } = req.body;
  const partyId = verifyParty(party, req.userParty);
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
app.post('/api/settlements/execute', authenticateToken, async (req, res) => {
  const { party, settlementId, buyerHoldingId, sellerHoldingId } = req.body;
  
  try {
    const partyId = verifyParty(party, req.userParty);
    // 1. Query the settlement contract to get buyer and seller party IDs
    const settlements = await queryContracts(partyId, 'AtomicSettlement:AtomicSettlement');
    const settlement = settlements.find(s => s.contractId === settlementId);
    if (!settlement) {
      return res.status(404).json({ error: `Settlement contract not found: ${settlementId}` });
    }
    
    const { buyer, seller, asset, quantity } = settlement.payload;
    
    const custodianParty = partyMap.Custodian;
    const { price } = settlement.payload;

    // Resolve or auto-mint the SELLER's asset holding
    let actualSellerHoldingId = sellerHoldingId;
    if (!actualSellerHoldingId) {
       const sellerHoldings = await queryContracts(seller, 'Daml.Finance.Interface.Holding.Base:Holding');
       let assetHolding = sellerHoldings.find(h => h.payload.instrument === asset && parseFloat(h.payload.amount) >= parseFloat(quantity));
       if (!assetHolding) {
         // Auto-mint the required asset holding for the seller in sandbox mode
         console.log(`[Settlement] Auto-minting ${quantity} ${asset} for seller ${seller}`);
         const mintResult = await createContract(seller, 'Daml.Finance.Interface.Holding.Base:Holding', {
           owner: seller,
           custodian: custodianParty,
           instrument: asset,
           amount: parseFloat(quantity).toString()
         });
         actualSellerHoldingId = mintResult.contractId;
         broadcast({ type: 'HOLDING_MINTED', party: seller, instrument: asset, amount: quantity });
       } else {
         actualSellerHoldingId = assetHolding.contractId;
       }
    }

    // Resolve or auto-mint the BUYER's USD holding
    let actualBuyerHoldingId = buyerHoldingId;
    if (!actualBuyerHoldingId) {
       const totalCost = parseFloat(price) * parseFloat(quantity);
       const buyerHoldings = await queryContracts(buyer, 'Daml.Finance.Interface.Holding.Base:Holding');
       let cashHolding = buyerHoldings.find(h => h.payload.instrument === 'USD' && parseFloat(h.payload.amount) >= totalCost);
       if (!cashHolding) {
         console.log(`[Settlement] Auto-minting ${totalCost} USD for buyer ${buyer}`);
         const mintResult = await createContract(buyer, 'Daml.Finance.Interface.Holding.Base:Holding', {
           owner: buyer,
           custodian: custodianParty,
           instrument: 'USD',
           amount: totalCost.toString()
         });
         actualBuyerHoldingId = mintResult.contractId;
         broadcast({ type: 'HOLDING_MINTED', party: buyer, instrument: 'USD', amount: totalCost });
       } else {
         actualBuyerHoldingId = cashHolding.contractId;
       }
    }
    
    // 2. Exercise Settle choice using the co-signed authority of BOTH buyer and seller
    const result = await exerciseChoice([buyer, seller], 'AtomicSettlement:AtomicSettlement', settlementId, 'Settle', {
      buyerHoldingId: actualBuyerHoldingId,
      sellerHoldingId: actualSellerHoldingId
    });
    
    console.log(`[API] Atomic settlement executed cooperatively for ${party}:`, settlementId);
    broadcast({ type: 'SETTLEMENT_EXECUTED', settlementId, party });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query settlements
app.get('/api/settlements', authenticateToken, async (req, res) => {
  const { party } = req.query;
  try {
    const partyId = verifyParty(party, req.userParty);
    const contracts = await queryContracts(partyId, 'AtomicSettlement:AtomicSettlement');
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get AuditRecords (Carol the Auditor and Traders)
app.get('/api/audit-records', authenticateToken, async (req, res) => {
  const { party } = req.query;
  try {
    const partyId = verifyParty(party, req.userParty);
    const records = await queryContracts(partyId, 'AuditRecord:AuditRecord');
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query RFQs (Market Maker / Trader)
app.get('/api/rfqs', authenticateToken, async (req, res) => {
  const { party } = req.query;
  try {
    const partyId = verifyParty(party, req.userParty);
    const rfqs = await queryContracts(partyId, 'RFQ:RFQBroadcast');
    const quotes = await queryContracts(partyId, 'RFQ:MarketMakerQuote');
    res.json({ rfqs, quotes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Market Maker Quote on RFQ
app.post('/api/quotes', authenticateToken, async (req, res) => {
  const { marketMaker, rfqId, quotePrice } = req.body;
  const mmParty = verifyParty(marketMaker, req.userParty);
  
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
app.post('/api/quotes/accept', authenticateToken, async (req, res) => {
  const { trader, quoteId } = req.body;
  const traderParty = verifyParty(trader, req.userParty);
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

// ---------------- PRIVATE CREDIT ENDPOINTS ----------------

// Get Collateral Vaults
app.get('/api/credit/vaults', authenticateToken, async (req, res) => {
  const { party } = req.query;
  try {
    const partyId = verifyParty(party, req.userParty);
    const vaults = await queryContracts(partyId, 'PrivateCredit:CollateralVault');
    res.json(vaults);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Loan Requests
app.get('/api/credit/requests', authenticateToken, async (req, res) => {
  const { party } = req.query;
  try {
    const partyId = verifyParty(party, req.userParty);
    const requests = await queryContracts(partyId, 'PrivateCredit:LoanRequest');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Active Loans
app.get('/api/credit/loans', authenticateToken, async (req, res) => {
  const { party } = req.query;
  try {
    const partyId = verifyParty(party, req.userParty);
    const loans = await queryContracts(partyId, 'PrivateCredit:ActiveLoan');
    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request Loan
app.post('/api/credit/request-loan', authenticateToken, async (req, res) => {
  const { trader, marketMaker, loanAsset, loanAmount, collateralAsset, collateralAmount, collateralHoldingId } = req.body;
  
  try {
    const traderParty = verifyParty(trader, req.userParty);
    const mmParty = resolveParty(marketMaker);

    const request = await createContract(traderParty, 'PrivateCredit:LoanRequest', {
      trader: traderParty,
      marketMaker: mmParty,
      loanAsset,
      loanAmount: parseFloat(loanAmount).toString(),
      collateralAsset,
      collateralAmount: parseFloat(collateralAmount).toString(),
      collateralHoldingId
    });
    console.log(`[API] Trader ${trader} requested a loan of ${loanAmount} ${loanAsset}`);
    broadcast({ type: 'LOAN_REQUESTED', trader, marketMaker, requestId: request.contractId });
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fund Loan
app.post('/api/credit/fund-loan', authenticateToken, async (req, res) => {
  const { marketMaker, requestId, loanHoldingId } = req.body;
  
  try {
    const mmParty = verifyParty(marketMaker, req.userParty);
    
    // We need the trader party to co-sign the transaction for visibility of the collateral
    const requests = await queryContracts(mmParty, 'PrivateCredit:LoanRequest');
    const request = requests.find(r => r.contractId === requestId);
    if (!request) {
      return res.status(404).json({ error: 'Loan Request not found or not visible' });
    }
    const traderParty = request.payload.trader;

    const result = await exerciseChoice([mmParty, traderParty], 'PrivateCredit:LoanRequest', requestId, 'FundLoan', {
      loanHoldingId
    });
    console.log(`[API] Market Maker ${marketMaker} funded loan request:`, requestId);
    broadcast({ type: 'LOAN_FUNDED', marketMaker, requestId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Repay Loan
app.post('/api/credit/repay-loan', authenticateToken, async (req, res) => {
  const { trader, loanId, repaymentHoldingId } = req.body;
  
  try {
    const traderParty = verifyParty(trader, req.userParty);
    
    // We need the marketMaker party to co-sign the transaction for visibility of the locked collateral
    const loans = await queryContracts(traderParty, 'PrivateCredit:ActiveLoan');
    const loan = loans.find(l => l.contractId === loanId);
    if (!loan) {
      return res.status(404).json({ error: 'Active Loan not found or not visible' });
    }
    const mmParty = loan.payload.marketMaker;

    const result = await exerciseChoice([traderParty, mmParty], 'PrivateCredit:ActiveLoan', loanId, 'RepayLoan', {
      repaymentHoldingId
    });
    console.log(`[API] Trader ${trader} repaid loan:`, loanId);
    broadcast({ type: 'LOAN_REPAID', trader, loanId });
    res.json(result);
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
  await resolveParties(process.env.CANTON_URL);
  isResolving = false;
}

// Start polling matching engine and expiry check
setInterval(async () => {
  // Try to resolve parties if not yet resolved
  if (Object.values(partyMap).some(v => !v.includes('::'))) {
    await startup();
    if (Object.values(partyMap).some(v => !v.includes('::'))) {
        return;
    }
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
