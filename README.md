# DarkPool.fi

## 🔗 Live Demo
https://darkpoolfi.vercel.app

## 🏗️ Deployment
- Frontend: https://darkpoolfi.vercel.app (Vercel)
- Backend: https://darkpool-production.up.railway.app (Railway)
- Canton: DevNet — Fivenorth Seaport Validator

DarkPool.fi is a decentralized, institutional-grade Over-The-Counter (OTC) trading platform built on the Canton Network. It leverages Daml smart contracts to execute atomic swaps with absolute sub-ledger privacy.

## Hackathon Track: Private DeFi & Capital Markets

This project was built specifically for the **Private DeFi & Capital Markets** track. Here is how it meets the judging criteria:

1. **Clear use of privacy/confidentiality**: We utilize Daml's sub-transaction privacy to create a true "Dark Pool" alongside a "Private Credit" lending desk. Unfilled orders and collateralized loans are strictly visible only to the participating parties. Other traders cannot see the order book or loan books, preventing front-running and information leakage.
2. **A real financial use case**: Institutional Over-The-Counter (OTC) block trading and Confidential Lending (Private Credit). Institutions need to trade large positions and borrow capital without moving public market prices. 
3. **Strong product logic**: We built an end-to-end atomic Delivery-vs-Payment (DvP) settlement flow with fallback mechanisms (RFQ) and dynamic partial-fill matching algorithms. We also implemented a natively secured, double-spend-proof private credit vault system.
4. **Institutional relevance**: Real-world dark pools require trusting a centralized operator. DarkPool.fi replaces institutional trust with cryptographic truth, guaranteeing counterparties remain strictly confidential while allowing selective, read-only transparency for Regulators.

## Features

- **Confidential Lending / Private Credit**: Borrowers can securely lock collateral (e.g., BTC, USTB) in a smart contract and request confidential USD loans from Market Makers without revealing their positions to the public ledger.
- **Advanced Partial Matching (`SplitIntent`)**: The dark pool automatically discovers optimal price overlaps and executes dynamic partial fills, returning residual liquidity to the pool while maintaining strict privacy.
- **Atomic Settlement (DvP)**: Multi-party co-signed settlement ensures that assets are exchanged simultaneously; if one leg fails, the entire transaction reverts.
- **Fallback RFQ Mechanism**: If a trader's order expires in the dark pool without a match, it graduates into a Request-For-Quote, broadcasted confidentially to Market Makers.
- **Institutional-Grade Security**: Natively secured backend enforcing JWT cryptographic parsing to prevent impersonation, strict memory-leak prevention, and ledger-enforced collateral locking.
- **Mobile Responsive UI**: A fully responsive React application supporting complex trading dashboards on the go.

## Architecture

1. **Frontend (React / Vite)**: User interfaces for Traders (to submit orders) and the Regulator (to audit privacy).
2. **Backend (Node.js / Express)**: An off-chain matching engine that routes matching TradeIntents into a `MatchProposal` contract, preserving strict Daml party visibility rules.
3. **Ledger (Canton / Daml)**: The underlying smart contracts enforcing execution constraints, privacy, and atomic holding transfers.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Java (JDK 17+)
- Daml SDK (`v2.10.4`)

### Installation & Running

1. **Start the Canton Sandbox**
   Navigate to the `daml` directory and start the local sandbox and JSON API:
   ```bash
   cd daml
   daml start
   ```

2. **Start the Backend Node Server**
   The backend orchestrates the matching engine and resolves party identifiers from the JSON API.
   ```bash
   cd backend
   npm install
   npm start
   ```

3. **Start the Frontend**
   Run the Vite development server to launch the DarkPool UI.
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Visit the `http://localhost:<PORT>` URL output by Vite to access the platform.

## Tech Stack
- Daml 2.10
- Node.js / Express
- React / TailwindCSS / Zustand
