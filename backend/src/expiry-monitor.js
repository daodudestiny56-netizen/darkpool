import { queryContracts, exerciseChoice, createContract } from './ledger.js';
import { partyMap } from './parties.js';

const graduatingIntents = new Set();

export async function checkExpiries(broadcastCallback) {
  const matcherParty = partyMap.MatchEngine;
  const mmParty = partyMap.MarketMaker;
  if (!matcherParty || !mmParty) return;
  
  try {
    const intents = await queryContracts(matcherParty, 'TradeIntent:TradeIntent');
    if (!intents || intents.length === 0) return;
    
    const now = new Date();
    
    for (const intent of intents) {
      if (intent.payload.status !== 'ACTIVE') continue;
      if (graduatingIntents.has(intent.contractId)) continue;
      
      const expiryTime = new Date(intent.payload.expiry);
      
      // If intent has expired, graduate it to a public RFQ
      if (expiryTime <= now) {
        console.log(`[ExpiryMonitor] Intent ${intent.contractId} has expired. Graduating to RFQ.`);
        graduatingIntents.add(intent.contractId);
        
        try {
          // 1. Update intent status on ledger to "RFQ"
          await exerciseChoice(matcherParty, 'TradeIntent:TradeIntent', intent.contractId, 'UpdateStatus', {
            newStatus: 'RFQ'
          });
          
          // 2. Create public RFQBroadcast on ledger (visible to MM)
          const rfq = await createContract(matcherParty, 'RFQ:RFQBroadcast', {
            matcher: matcherParty,
            asset: intent.payload.asset,
            side: intent.payload.side,
            quantity: intent.payload.quantity,
            price: intent.payload.price,
            expiry: intent.payload.expiry,
            status: 'OPEN',
            marketMakers: [mmParty],
            originalIntentTrader: intent.payload.trader
          });
          
          console.log('[ExpiryMonitor] Successfully graduated to RFQBroadcast:', rfq.contractId);
          
          if (broadcastCallback) {
            broadcastCallback({
              type: 'RFQ_GRADUATION',
              intentId: intent.contractId,
              rfqId: rfq.contractId,
              asset: intent.payload.asset,
              quantity: intent.payload.quantity,
              price: intent.payload.price,
              trader: intent.payload.trader
            });
          }
        } catch (err) {
          console.error('[ExpiryMonitor] Failed to graduate intent:', err.message);
          graduatingIntents.delete(intent.contractId);
        }
      }
    }
  } catch (err) {
    console.error('[ExpiryMonitor] Error checking expiries:', err.message);
  }
}
