const API_URL = 'http://localhost:5000';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testFlow() {
  console.log('=== STARTING DARKPOOL.FI INTEGRATION TESTS ===');

  // 1. Fetch parties
  console.log('\n[Step 1] Fetching active parties...');
  const resParties = await fetch(`${API_URL}/api/parties`);
  if (!resParties.ok) throw new Error('Failed to fetch parties');
  const parties = await resParties.json();
  console.log('Active Parties:', parties);

  // Helper to query balances
  const getBalances = async (party) => {
    const res = await fetch(`${API_URL}/api/holdings?party=${party}`);
    if (!res.ok) throw new Error(`Failed to fetch holdings for ${party}`);
    const holdings = await res.json();
    let usd = 0, btc = 0;
    for (const h of holdings) {
      if (h.payload.instrument === 'USD') usd += parseFloat(h.payload.amount);
      if (h.payload.instrument === 'BTC') btc += parseFloat(h.payload.amount);
    }
    return { usd, btc, raw: holdings };
  };

  // 2. Mint Holdings
  console.log('\n[Step 2] Minting initial holdings...');
  await fetch(`${API_URL}/api/holdings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: 'Alice', instrument: 'USD', amount: 100000 })
  });
  await fetch(`${API_URL}/api/holdings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: 'Bob', instrument: 'BTC', amount: 2.0 })
  });

  const aliceBalInit = await getBalances('Alice');
  const bobBalInit = await getBalances('Bob');
  console.log('Alice Balances:', aliceBalInit);
  console.log('Bob Balances:', bobBalInit);

  // 3. Post BUY & SELL intents
  console.log('\n[Step 3] Submitting matching Trade Intents...');
  const buyRes = await fetch(`${API_URL}/api/intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trader: 'Alice',
      asset: 'BTC',
      side: 'BUY',
      quantity: 2.0,
      price: 50000,
      expirySecs: 60
    })
  });
  const sellRes = await fetch(`${API_URL}/api/intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trader: 'Bob',
      asset: 'BTC',
      side: 'SELL',
      quantity: 2.0,
      price: 50000,
      expirySecs: 60
    })
  });

  if (!buyRes.ok || !sellRes.ok) throw new Error('Failed to post intents');
  console.log('-> Intents successfully submitted on ledger [PASS]');

  // 4. Wait for matching engine
  console.log('\n[Step 4] Polling for Match Proposal...');
  let proposal = null;
  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    const propRes = await fetch(`${API_URL}/api/proposals?party=Alice`);
    const data = await propRes.json();
    if (data.proposals && data.proposals.length > 0) {
      proposal = data.proposals[0];
      break;
    }
  }

  if (!proposal) throw new Error('Matching engine failed to propose match within timeout');
  console.log('Matched Proposal found:', proposal.contractId);
  console.log('-> Match proposal generated [PASS]');

  // 5. Accept proposal (Buyer Accept)
  console.log('\n[Step 5] Signing Match Proposal as Buyer (Alice)...');
  const acceptBuyRes = await fetch(`${API_URL}/api/proposals/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      party: 'Alice',
      proposalId: proposal.contractId,
      role: 'buyer'
    })
  });
  if (!acceptBuyRes.ok) throw new Error('Buyer signature failed');
  console.log('-> Buyer signed proposal [PASS]');

  // 6. Co-sign proposal (Seller Accept)
  console.log('\n[Step 6] Co-signing Match Proposal as Seller (Bob)...');
  let acceptedProposal = null;
  for (let i = 0; i < 5; i++) {
    await sleep(1500);
    const propRes = await fetch(`${API_URL}/api/proposals?party=Bob`);
    const data = await propRes.json();
    if (data.buyerAccepted && data.buyerAccepted.length > 0) {
      acceptedProposal = data.buyerAccepted[0];
      break;
    }
  }

  if (!acceptedProposal) throw new Error('Buyer-accepted proposal not visible to seller');
  
  const acceptSellRes = await fetch(`${API_URL}/api/proposals/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      party: 'Bob',
      proposalId: acceptedProposal.contractId,
      role: 'seller'
    })
  });
  if (!acceptSellRes.ok) throw new Error('Seller signature failed');
  console.log('-> Seller co-signed proposal. Settlement contract created [PASS]');

  // 7. Settle the Trade
  console.log('\n[Step 7] Executing Atomic Settlement...');
  // Fetch Alice's USD holding contractId
  const aliceUSD = (await getBalances('Alice')).raw.find(h => h.payload.instrument === 'USD');
  // Fetch Bob's BTC holding contractId
  const bobBTC = (await getBalances('Bob')).raw.find(h => h.payload.instrument === 'BTC');

  if (!aliceUSD || !bobBTC) throw new Error('Missing holdings for settlement execution');

  // Let's resolve the AtomicSettlement contract ID
  let settlements = [];
  for (let i = 0; i < 5; i++) {
    await sleep(1500);
    const setRes = await fetch(`${API_URL}/api/settlements?party=Alice`);
    settlements = await setRes.json();
    if (settlements.length > 0) break;
  }

  if (settlements.length === 0) throw new Error('No AtomicSettlement contract found');
  const settlementId = settlements[0].contractId;
  console.log('Found AtomicSettlement:', settlementId);

  const settleRes = await fetch(`${API_URL}/api/settlements/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      party: 'Alice',
      settlementId,
      buyerHoldingId: aliceUSD.contractId,
      sellerHoldingId: bobBTC.contractId
    })
  });

  if (!settleRes.ok) {
    const errorData = await settleRes.json();
    throw new Error(`Settlement execution failed: ${errorData.error}`);
  }
  console.log('-> Settlement executed successfully [PASS]');

  // 8. Verify post-settlement balances
  console.log('\n[Step 8] Verifying Swapped Ledger Balances...');
  const aliceBalFinal = await getBalances('Alice');
  const bobBalFinal = await getBalances('Bob');
  console.log('Final Alice Balances:', aliceBalFinal);
  console.log('Final Bob Balances:', bobBalFinal);

  if (aliceBalFinal.btc !== 2.0) throw new Error('Alice did not receive 2.0 BTC');
  if (bobBalFinal.usd !== 100000) throw new Error('Bob did not receive $100,000');
  console.log('-> Assets swapped perfectly on ledger [PASS]');

  // 9. Regulatory compliance checking
  console.log('\n[Step 9] Verifying Regulatory Audit Logs & Sub-Ledger Privacy...');
  // Carol (Auditor) fetches records
  const auditRes = await fetch(`${API_URL}/api/audit-records?party=Carol`);
  if (!auditRes.ok) throw new Error('Auditor fetch failed');
  const auditRecords = await auditRes.json();
  console.log(`Auditor found ${auditRecords.length} settled trade record(s).`);
  if (auditRecords.length === 0) throw new Error('Audit record not found for Carol');
  console.log('-> Regulator audit logging verified [PASS]');

  // Verify that Carol has ZERO visibility into active/historical TradeIntents
  const carolIntentsRes = await fetch(`${API_URL}/api/intents?party=Carol`);
  const carolIntents = await carolIntentsRes.json();
  console.log(`Carol (Regulator) active intents query returned ${carolIntents.length} records.`);
  if (carolIntents.length > 0) throw new Error('PRIVACY LEAK: Carol is able to inspect TradeIntents!');
  console.log('-> Sub-ledger privacy boundaries verified [PASS]');

  // 10. Expiry & RFQ Graduation
  console.log('\n[Step 10] Testing Expiry and RFQ Fallback Graduation...');
  // Post BUY intent with 4s expiry
  const mmUSD = await fetch(`${API_URL}/api/holdings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: 'MarketMaker', instrument: 'BTC', amount: 3.0 })
  });

  const rfqBuyRes = await fetch(`${API_URL}/api/intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trader: 'Alice',
      asset: 'BTC',
      side: 'BUY',
      quantity: 2.0,
      price: 49500,
      expirySecs: 3 // Expire in 3 seconds to graduate
    })
  });
  if (!rfqBuyRes.ok) throw new Error('Failed to post RFQ intent');
  console.log('Alice submitted RFQ intent with 3s expiry.');

  console.log('Waiting 5s for intent expiry and RFQ graduation...');
  await sleep(5000);

  // Fetch RFQs as Market Maker
  const rfqRes = await fetch(`${API_URL}/api/rfqs?party=MarketMaker`);
  const rfqData = await rfqRes.json();
  if (rfqData.rfqs.length === 0) throw new Error('Intent failed to graduate to public RFQBroadcast');
  const rfq = rfqData.rfqs[0];
  console.log('Found graduated RFQ:', rfq.contractId);
  console.log('-> RFQ graduation verified [PASS]');

  // Submit quote as Market Maker
  console.log('\n[Step 11] Market Maker Submitting Quote on RFQ...');
  const quoteRes = await fetch(`${API_URL}/api/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      marketMaker: 'MarketMaker',
      rfqId: rfq.contractId,
      quotePrice: 49500
    })
  });
  if (!quoteRes.ok) throw new Error('Failed to submit MM quote');
  console.log('MM quoted $49,500.');

  await sleep(2000);

  // Fetch quotes as Alice (Trader)
  const traderRfqRes = await fetch(`${API_URL}/api/rfqs?party=Alice`);
  const traderRfqData = await traderRfqRes.json();
  if (traderRfqData.quotes.length === 0) throw new Error('MM quote not visible to trader');
  const quote = traderRfqData.quotes[0];
  console.log('Trader received MM quote:', quote.contractId);

  // Accept quote
  console.log('\n[Step 12] Trader Accepting MM Quote...');
  const acceptQuoteRes = await fetch(`${API_URL}/api/quotes/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trader: 'Alice',
      quoteId: quote.contractId
    })
  });
  if (!acceptQuoteRes.ok) throw new Error('Quote acceptance failed');
  console.log('-> Quote accepted by trader [PASS]');

  await sleep(2000);

  // Settle RFQ trade
  console.log('\n[Step 13] Settling the RFQ Trade...');
  const rfqSettlements = await (await fetch(`${API_URL}/api/settlements?party=Alice`)).json();
  if (rfqSettlements.length === 0) throw new Error('No AtomicSettlement found for RFQ trade');
  const rfqSettlementId = rfqSettlements[0].contractId;

  // Let's mint USD 99k to Alice to settle this trade exactly
  console.log('Minting exact $99,000 USD to Alice to cover RFQ price...');
  await fetch(`${API_URL}/api/holdings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: 'Alice', instrument: 'USD', amount: 99000 })
  });

  const aliceUSD_rfq = (await getBalances('Alice')).raw.find(h => h.payload.instrument === 'USD' && parseFloat(h.payload.amount) === 99000);
  const mmBTC_rfq = (await getBalances('MarketMaker')).raw.find(h => h.payload.instrument === 'BTC' && parseFloat(h.payload.amount) >= 2.0);

  if (!aliceUSD_rfq || !mmBTC_rfq) throw new Error('Missing exact holdings for RFQ settlement');

  console.log(`Executing swap: USD holding ${aliceUSD_rfq.contractId} and BTC holding ${mmBTC_rfq.contractId}`);
  const rfqSettleRes = await fetch(`${API_URL}/api/settlements/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      party: 'Alice',
      settlementId: rfqSettlementId,
      buyerHoldingId: aliceUSD_rfq.contractId,
      sellerHoldingId: mmBTC_rfq.contractId
    })
  });

  if (!rfqSettleRes.ok) {
    const errorData = await rfqSettleRes.json();
    throw new Error(`RFQ Settlement execution failed: ${errorData.error}`);
  }
  console.log('-> RFQ Settle completed successfully [PASS]');

  console.log('\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===');
}

testFlow().catch(err => {
  console.error('\n[TEST RUN FAILURE]:', err.message);
  process.exit(1);
});
