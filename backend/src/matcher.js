import { queryContracts, createContract } from './ledger.js';
import { partyMap } from './parties.js';

// Local cache to avoid proposing duplicate matches for the same intents
const proposedIntents = new Set();

export async function runMatcher() {
  const matcherParty = partyMap.MatchEngine;
  if (!matcherParty) return;
  
  try {
    // 1. Fetch all TradeIntent contracts visible to the MatchEngine
    const intents = await queryContracts(matcherParty, 'TradeIntent:TradeIntent');
    if (!intents || intents.length === 0) return;
    
    // Filter active intents and exclude already matched/proposed ones
    const activeIntents = intents.filter(c => 
      c.payload.status === 'ACTIVE' && 
      !proposedIntents.has(c.contractId)
    );
    
    // Group active intents by asset
    const byAsset = {};
    for (const intent of activeIntents) {
      const asset = intent.payload.asset;
      if (!byAsset[asset]) byAsset[asset] = { buys: [], sells: [] };
      if (intent.payload.side === 'BUY') {
        byAsset[asset].buys.push(intent);
      } else {
        byAsset[asset].sells.push(intent);
      }
    }
    
    // 2. Perform matching logic
    for (const asset of Object.keys(byAsset)) {
      const { buys, sells } = byAsset[asset];
      
      for (const buy of buys) {
        for (const sell of sells) {
          // Check if already matched
          if (proposedIntents.has(buy.contractId) || proposedIntents.has(sell.contractId)) {
            continue;
          }
          
          const buyPrice = parseFloat(buy.payload.price);
          const sellPrice = parseFloat(sell.payload.price);
          const buyQty = parseFloat(buy.payload.quantity);
          const sellQty = parseFloat(sell.payload.quantity);
          
          // Match criteria: price overlap and exact quantity match for simple OTC pool
          if (buyPrice >= sellPrice && buyQty === sellQty) {
            console.log(`[Matcher] Match found for ${asset}: Buy limit $${buyPrice}, Sell limit $${sellPrice}, Qty ${buyQty}`);
            
            // Propose match at the midpoint price
            const matchPrice = (buyPrice + sellPrice) / 2;
            
            proposedIntents.add(buy.contractId);
            proposedIntents.add(sell.contractId);
            
            try {
              const proposal = await createContract(matcherParty, 'MatchProposal:MatchProposal', {
                matcher: matcherParty,
                buyer: buy.payload.trader,
                seller: sell.payload.trader,
                asset: asset,
                quantity: buyQty.toString(),
                price: matchPrice.toString(),
                buyerIntentId: buy.contractId,
                sellerIntentId: sell.contractId
              });
              
              console.log('[Matcher] Successfully created MatchProposal:', proposal.contractId);
            } catch (err) {
              console.error('[Matcher] Failed to create MatchProposal:', err.message);
              // Rollback cache
              proposedIntents.delete(buy.contractId);
              proposedIntents.delete(sell.contractId);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[Matcher] Error in matcher loop:', err.message);
  }
}
