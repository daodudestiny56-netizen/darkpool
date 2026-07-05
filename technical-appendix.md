# Technical Appendix: DarkPool.fi Architecture

This appendix details the cryptographic and architectural choices made in the design of DarkPool.fi on the Canton Network.

## 1. Sub-Ledger Privacy via Daml

Daml natively enforces strong privacy guarantees on the Canton Network. In DarkPool.fi, privacy is not an afterthought implemented via complex ZK-proofs, but rather a fundamental property of the ledger model.

### 1.1 Trade Intents Visibility
When a `TradeIntent` contract is created, it only has two observers:
1. The **Trader** (Signatory)
2. The **MatchEngine** (Observer)

Because Daml uses sub-transaction privacy, the Regulator (`Carol`), other Traders, and Market Makers **cannot** see this contract. They cannot query it via the JSON API, and the Canton synchronizer will not distribute the contract payload to their participant nodes. This prevents front-running and guarantees dark pool confidentiality.

### 1.2 Regulator Auditing (`AuditRecord`)
Regulators only gain visibility into trades *after* they settle. During the `AtomicSettlement` execution, an `AuditRecord` contract is spawned. The Regulator (`Carol`) is an explicit observer on this contract, allowing them to query the finalized asset, price, quantity, and parties involved, while remaining blind to unexecuted or cancelled orders.

## 2. Atomic Settlement

The `AtomicSettlement` contract guarantees Delivery-vs-Payment (DvP). The `Settle` choice requires the signatures of *both* the buyer and seller (via the `MatchProposal` co-signing flow). 

During settlement, the Daml engine atomically executes the transfers of the underlying `Holding` contracts (e.g., USD and BTC). If either transfer fails (e.g., insufficient funds), the entire transaction rolls back. There is no intermediate state where one party holds both assets.

## 3. Off-Chain Matching Engine

The Matching Engine is a centralized Node.js component. While the ledger enforces the atomic swap and privacy rules, the matching engine provides the computational efficiency needed for order book matching. 

1. The Engine polls the JSON API for active `TradeIntent`s.
2. It pairs matching BUY/SELL intents.
3. It proposes a `MatchProposal` to the involved traders.
4. The traders co-sign the proposal, which natively triggers the `AtomicSettlement` contract.

This architecture delegates heavy continuous computation (order matching) off-chain, while maintaining the strict cryptographic enforcement of settlement and privacy on-chain.

## 4. Advanced Dark Pool Partial Matching

To provide institutional-grade liquidity, DarkPool.fi supports partial matching.

When the Matching Engine finds crossing intents with mismatched quantities (e.g., Alice buys 5 BTC, Bob sells 3 BTC):
1. The engine calculates the minimum matching quantity (3 BTC).
2. It exercises a `SplitIntent` choice on the larger intent (Alice's).
3. The `SplitIntent` choice archives the original intent and atomically spawns two new intents:
   - A matched intent for 3 BTC.
   - A residual intent for 2 BTC, which returns to the order book.
4. The matching engine then proposes the swap for the 3 BTC intents.

This ensures seamless liquidity provision without requiring exact 1-to-1 quantity matches, all while maintaining the sub-ledger privacy of the residual intents.

## 5. Private Credit & Confidential Lending

DarkPool.fi extends its capabilities beyond trading to OTC capital markets, specifically implementing Confidential Lending.

Institutional borrowers can lock assets (e.g., BTC, USTB) as collateral to borrow liquidity (e.g., USD Cash) confidentially.
1. **CollateralVault**: A borrower creates a `CollateralVault` transferring their asset to the `MarketMaker`.
2. **LoanRequest**: A confidential `LoanRequest` is submitted, visible only to the borrower and the Market Maker.
3. **Funding**: The Market Maker exercises the `Fund` choice, transferring the requested USD to the borrower and creating an `ActiveLoan`.
4. **Repayment**: When the borrower repays the principal, the `Repay` choice atomically transfers the USD back to the Market Maker and unlocks the `CollateralVault`, returning the collateral to the borrower.

Because these operations are modeled as Daml smart contracts, the exact terms, collateral ratios, and loan amounts remain completely hidden from the public order book and other market participants, fulfilling the core requirement for "Private DeFi & Capital Markets".
