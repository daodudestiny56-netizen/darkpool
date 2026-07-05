import { queryContracts, createContract } from './ledger.js';
import { partyMap } from './parties.js';

export async function runMatcher() {
  const matcherParty = partyMap.MatchEngine;
  if (!matcherParty) return;
  
  try {
    // 1. Fetch all TradeIntent contracts visible to the MatchEngine
    const intents = await queryContracts(matcherParty, 'TradeIntent:TradeIntent');
    if (!intents || intents.length === 0) return;
    
    // Fetch active MatchProposals to prevent duplicating matches for the same intent
    const proposals = await queryContracts(matcherParty, 'MatchProposal:MatchProposal');
    const proposedIntentIds = new Set();
    proposals.forEach(p => {
      proposedIntentIds.add(p.payload.buyerIntentId);
      proposedIntentIds.add(p.payload.sellerIntentId);
    });
    
    // Filter active intents and exclude already matched/proposed ones
    const activeIntents = intents.filter(c => 
      c.payload.status === 'ACTIVE' && 
      !proposedIntentIds.has(c.contractId)
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
          // Check if already matched in this cycle
          if (proposedIntentIds.has(buy.contractId) || proposedIntentIds.has(sell.contractId)) {
            continue;
          }
          
          const buyPrice = parseFloat(buy.payload.price);
          const sellPrice = parseFloat(sell.payload.price);
          const buyQty = parseFloat(buy.payload.quantity);
          const sellQty = parseFloat(sell.payload.quantity);
          
          // Match criteria: price overlap (Partial Matching allowed!)
          if (buyPrice >= sellPrice) {
            const matchedQty = Math.min(buyQty, sellQty);
            const matchPrice = (buyPrice + sellPrice) / 2;
            
            console.log(`[Matcher] Partial Match found for ${asset}: Buy limit $${buyPrice}, Sell limit $${sellPrice}, Matched Qty ${matchedQty}`);
            
            proposedIntentIds.add(buy.contractId);
            proposedIntentIds.add(sell.contractId);
            
            try {
              let finalBuyIntentId = buy.contractId;
              let finalSellIntentId = sell.contractId;
              
              const { exerciseChoice } = await import('./ledger.js');

              // Split Buy Intent if necessary
              if (buyQty > matchedQty) {
                const splitResult = await exerciseChoice(matcherParty, 'TradeIntent:TradeIntent', buy.contractId, 'SplitIntent', {
                  splitQuantity: matchedQty.toString()
                });
                finalBuyIntentId = splitResult.exerciseResult[0];
              }

              // Split Sell Intent if necessary
              if (sellQty > matchedQty) {
                const splitResult = await exerciseChoice(matcherParty, 'TradeIntent:TradeIntent', sell.contractId, 'SplitIntent', {
                  splitQuantity: matchedQty.toString()
                });
                finalSellIntentId = splitResult.exerciseResult[0];
              }

              const proposal = await createContract(matcherParty, 'MatchProposal:MatchProposal', {
                matcher: matcherParty,
                buyer: buy.payload.trader,
                seller: sell.payload.trader,
                asset: asset,
                quantity: matchedQty.toString(),
                price: matchPrice.toString(),
                buyerIntentId: finalBuyIntentId,
                sellerIntentId: finalSellIntentId
              });
              
              console.log('[Matcher] Successfully created MatchProposal:', proposal.contractId);
            } catch (err) {
              console.error('[Matcher] Failed to process partial match:', err.message);
              // Rollback cache
              proposedIntentIds.delete(buy.contractId);
              proposedIntentIds.delete(sell.contractId);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[Matcher] Error in matcher loop:', err.message);
  }
}
