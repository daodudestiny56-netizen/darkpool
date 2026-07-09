import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { useTradingStore } from '../store/tradingStore';
import ExpiryRing from '../components/trading/ExpiryRing';
import PrivacyBadge from '../components/trading/PrivacyBadge';
import MatchAlert from '../components/trading/MatchAlert';
import { Activity, ArrowRight, RefreshCw, LogOut, Loader2 } from 'lucide-react';

const API_URL = 'http://localhost:5000';

const ASSETS = [
  { symbol: 'BTC',   name: 'Bitcoin',            type: 'Crypto' },
  { symbol: 'ETH',   name: 'Ethereum',            type: 'Crypto' },
  { symbol: 'USDC',  name: 'USD Coin',            type: 'Stablecoin' },
  { symbol: 'USDT',  name: 'Tether',              type: 'Stablecoin' },
  { symbol: 'USTB',  name: 'US Treasury Bill',    type: 'RWA' },
  { symbol: 'XAUT',  name: 'Tokenised Gold',       type: 'RWA' },
  { symbol: 'RBOND', name: 'Real Estate Bond',    type: 'RWA' },
];

const TraderDashboard = () => {
  const navigate = useNavigate();
  const { address, partyId, jwt, disconnect } = useWalletStore();
  const {
    role, intents, proposals, buyerAccepted, settlements, holdings, auditRecords,
    fetchData, postIntent, acceptProposal, executeSettlement, mintHolding,
  } = useTradingStore();

  const [asset, setAsset] = useState('BTC');
  const [quantity, setQuantity] = useState('2.0');
  const [price, setPrice] = useState('50000.0');
  const [expirySecs, setExpirySecs] = useState('20');
  
  // Private Credit State
  const [activeTab, setActiveTab] = useState('exchange');
  const [loanAsset, setLoanAsset] = useState('USD');
  const [loanAmount, setLoanAmount] = useState('10000');
  const [collateralAsset, setCollateralAsset] = useState('BTC');
  const [collateralAmount, setCollateralAmount] = useState('0.5');

  const [showMatchAlert, setShowMatchAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const ws = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const getTraderName = () => {
    return partyId || address;
  };

  const updateData = () => fetchData(getTraderName(), jwt);

  const isInitialFetch = useRef(true);
  useEffect(() => {
    updateData().then(() => {
      isInitialFetch.current = false;
    });
    ws.current = new WebSocket('ws://localhost:5000');
    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'INTENT_CREATED') showToast(`Intent created for ${msg.party}`);
      if (msg.type === 'PROPOSAL_ACCEPTED_BUYER') showToast('Match signed by buyer.');
      if (msg.type === 'PROPOSAL_ACCEPTED_SELLER') showToast('Co-signed by seller. Settlement ready.');
      if (msg.type === 'SETTLEMENT_EXECUTED') showToast('Atomic settlement complete!');
      if (msg.type === 'QUOTE_SUBMITTED') showToast(`Market Maker quoted $${msg.quote?.payload?.price} on RFQ`);
      if (msg.type === 'LOAN_REQUESTED') showToast(`Loan requested for ${msg.trader}`);
      if (msg.type === 'LOAN_FUNDED') showToast(`Loan funded by Market Maker`);
      if (msg.type === 'LOAN_REPAID') showToast(`Loan repaid by trader`);
      updateData();
    };

    return () => { ws.current?.close(); };
  }, [address]);

  // Alert when new proposals arrive
  const prevProposalsLength = useRef(proposals.length);
  useEffect(() => {
    if (!isInitialFetch.current && proposals.length > prevProposalsLength.current) {
      setShowMatchAlert(true);
    }
    prevProposalsLength.current = proposals.length;
  }, [proposals.length]);

  const handleSubmitIntent = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await postIntent(getTraderName(), asset, role === 'BUYER' ? 'BUY' : 'SELL', quantity, price, expirySecs, jwt);
      showToast('Intent posted successfully.');
      updateData();
    } catch (err) { showToast(`Error: ${err.message}`); }
    finally { setIsSubmitting(false); }
  };

  const handleSignProposal = async (proposalId, roleType) => {
    try {
      await acceptProposal(getTraderName(), proposalId, roleType, jwt);
      showToast('Proposal signed.');
      updateData();
    } catch (err) { showToast(`Sign failed: ${err.message}`); }
  };

  const handleSettleTrade = async (settlementId, buyer, seller, assetClass) => {
    try {
      showToast('Resolving counterparty details…');
      const usdHolding = holdings.find(h => h.payload.instrument === 'USD');
      if (role === 'BUYER' && !usdHolding) { alert('You need a USD holding. Mint some from the Faucet.'); return; }
      const cpName = (seller?.includes('MarketMaker') || seller?.includes('party-083b')) ? 'MarketMaker' : 'Bob';
      const cpRes = await fetch(`${API_URL}/api/holdings?party=${cpName}`, { headers: { Authorization: `Bearer ${jwt}` } });
      if (!cpRes.ok) throw new Error('Failed to resolve counterparty holding');
      const cpHoldings = await cpRes.json();
      const assetHolding = cpHoldings.find(h => h.payload.instrument === assetClass);
      if (!assetHolding) { alert(`${cpName} has no ${assetClass} holding to settle!`); return; }
      showToast('Submitting atomic swap…');
      await executeSettlement(getTraderName(), settlementId, usdHolding.contractId, assetHolding.contractId, jwt);
      showToast('Atomic Settlement Complete!');
      updateData();
    } catch (err) { showToast(`Settlement failed: ${err.message}`); }
  };

  const handleFaucetMint = async (instrument, amount) => {
    try {
      await mintHolding(getTraderName(), instrument, amount, jwt);
      showToast(`Minted ${amount} ${instrument}`);
      updateData();
    } catch (err) { showToast(`Mint failed: ${err.message}`); }
  };

  const { requestLoan, repayLoan, vaults, loanRequests, activeLoans } = useTradingStore();

  const handleRequestLoan = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Find collateral holding
      const cHolding = holdings.find(h => h.payload.instrument === collateralAsset && parseFloat(h.payload.amount) >= parseFloat(collateralAmount));
      if (!cHolding) { alert(`You need at least ${collateralAmount} ${collateralAsset} holding to use as collateral. Mint from faucet.`); setIsSubmitting(false); return; }
      
      const mmParty = 'MarketMaker';
      await requestLoan(getTraderName(), mmParty, loanAsset, loanAmount, collateralAsset, collateralAmount, cHolding.contractId, jwt);
      showToast('Loan Request submitted to Market Makers.');
      updateData();
    } catch (err) { showToast(`Loan request failed: ${err.message}`); }
    finally { setIsSubmitting(false); }
  };

  const handleRepayLoan = async (loanId, loanAsset, loanAmount) => {
    try {
      const repaymentHolding = holdings.find(h => h.payload.instrument === loanAsset && parseFloat(h.payload.amount) >= parseFloat(loanAmount));
      if (!repaymentHolding) { alert(`You need at least ${loanAmount} ${loanAsset} to repay this loan.`); return; }
      
      await repayLoan(getTraderName(), loanId, repaymentHolding.contractId, jwt);
      showToast('Loan repaid successfully. Collateral unlocked.');
      updateData();
    } catch (err) { showToast(`Repayment failed: ${err.message}`); }
  };

  let usdBal = 0, btcBal = 0, ustbBal = 0;
  holdings.forEach(h => {
    if (h.payload.instrument === 'USD')  usdBal  += parseFloat(h.payload.amount);
    if (h.payload.instrument === 'BTC')  btcBal  += parseFloat(h.payload.amount);
    if (h.payload.instrument === 'USTB') ustbBal += parseFloat(h.payload.amount);
  });

  const isBuyer  = role === 'BUYER';
  const roleColor = isBuyer ? '#1A7F4B' : '#C0392B';

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-dp-parchment">
      {showMatchAlert && <MatchAlert onClose={() => setShowMatchAlert(false)} />}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 toast-slide bg-white border border-dp-border shadow-luxury rounded-2xl px-5 py-3.5 flex items-center gap-3 max-w-xs">
          <Activity size={15} className="text-dp-gold shrink-0" />
          <span className="font-sans text-dp-text text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Navbar */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center px-6 py-3.5 bg-white border-b border-dp-border shadow-sm gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 w-full md:w-auto">
          <span
            className="font-display font-bold text-xl text-dp-text cursor-pointer shrink-0"
            onClick={() => navigate('/role')}
          >
            Dark<span className="text-gold">Pool</span>.fi
          </span>
          <nav className="flex gap-2 md:gap-4 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-hide">
            <button
              onClick={() => setActiveTab('exchange')}
              className={`font-display font-semibold text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${activeTab === 'exchange' ? 'bg-dp-parchment text-dp-text border border-dp-border' : 'text-dp-muted hover:text-dp-text'}`}
            >
              OTC Exchange
            </button>
            <button
              onClick={() => setActiveTab('credit')}
              className={`font-display font-semibold text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${activeTab === 'credit' ? 'bg-dp-parchment text-dp-text border border-dp-border' : 'text-dp-muted hover:text-dp-text'}`}
            >
              Private Credit
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span
            className="font-sans text-xs font-semibold px-3 py-1.5 rounded-full border"
            style={{ color: roleColor, background: `${roleColor}0F`, borderColor: `${roleColor}30` }}
          >
            ● {role}
          </span>
          <div className="flex items-center gap-2 text-xs font-sans text-dp-muted">
            <span className="live-dot" />
            Ledger Online
          </div>
          <button
            onClick={() => { disconnect(); navigate('/'); }}
            className="flex items-center gap-1.5 font-sans text-xs text-dp-muted hover:text-dp-crimson transition-colors"
          >
            <LogOut size={13} /> Disconnect
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-dp-border flex flex-col p-5 gap-5 overflow-y-auto shrink-0">
          {/* Party ID */}
          <div className="bg-dp-parchment border border-dp-border rounded-xl p-3.5">
            <span className="label block mb-1.5">Canton Party ID</span>
            <div className="font-data text-xs text-dp-muted break-all leading-relaxed">{partyId || '—'}</div>
          </div>

          {/* Balances */}
          <div>
            <span className="label block mb-3">Ledger Balances</span>
            <div className="flex flex-col gap-1">
              {[
                { label: 'USD Cash',    value: `$${usdBal.toLocaleString()}`,     color: '#1A7F4B' },
                { label: 'BTC',         value: `${btcBal.toFixed(4)} BTC`,        color: '#C89B3C' },
                { label: 'USTB T-Bills',value: `$${ustbBal.toLocaleString()}`,    color: '#3D3B8E' },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-dp-linen transition-colors"
                >
                  <span className="font-sans text-xs text-dp-muted">{label}</span>
                  <span className="font-data text-xs font-semibold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <hr className="sep" />

          {/* Faucet */}
          <div>
            <span className="label block mb-3">Sandbox Faucet</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['+ $50k USD', 'USD', 50000],
                ['+ 2 BTC',    'BTC', 2.0],
                ['+ $10k USTB','USTB', 10000],
              ].map(([label, instrument, amount]) => (
                <button
                  key={label}
                  onClick={() => handleFaucetMint(instrument, amount)}
                  className="font-sans text-xs font-medium py-2 px-3 rounded-lg bg-dp-parchment border border-dp-border hover:border-dp-gold/60 hover:bg-dp-gold/5 text-dp-muted hover:text-dp-gold transition-all"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
          <div className="flex items-center justify-between border-b border-dp-border pb-4">
            <h2 className="font-display font-bold text-2xl text-dp-text">
              {activeTab === 'exchange' ? 'OTC Dark Trading Desk' : 'Confidential Borrowing'}
            </h2>
            <button
              onClick={updateData}
              className="flex items-center gap-2 font-sans text-xs text-dp-muted hover:text-dp-indigo border border-dp-border rounded-full px-3 py-1.5 hover:border-dp-indigo/40 transition-all"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6">
            {activeTab === 'exchange' ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Intent Form */}
              <div className="lg:col-span-1 bg-white border border-dp-border rounded-2xl p-5 flex flex-col gap-4 shadow-card">
                <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block">
                  Post Intent
                  <span className="ml-2 text-sm font-serif italic text-dp-muted font-normal">(dark)</span>
                </span>

                <form onSubmit={handleSubmitIntent} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="label">Asset Class</label>
                    <select
                      value={asset}
                      onChange={e => setAsset(e.target.value)}
                      className="dp-input dp-select"
                    >
                      {ASSETS.map(a => (
                        <option key={a.symbol} value={a.symbol}>{a.symbol} – {a.name} ({a.type})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="label">Quantity</label>
                      <input
                        type="number" step="0.1" value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        className="dp-input" required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="label">Limit Price (USD)</label>
                      <input
                        type="number" step="1" value={price}
                        onChange={e => setPrice(e.target.value)}
                        className="dp-input" required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="label">Expiry Window</label>
                    <select value={expirySecs} onChange={e => setExpirySecs(e.target.value)} className="dp-input dp-select">
                      <option value="20">20 Seconds (demo)</option>
                      <option value="60">60 Seconds</option>
                      <option value="300">5 Minutes</option>
                      <option value="1800">30 Minutes</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full font-display font-semibold text-sm py-3 rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{
                      background: isBuyer ? '#1A7F4B' : '#C0392B',
                      color: '#fff',
                      boxShadow: isBuyer ? '0 4px 18px rgba(26,127,75,0.25)' : '0 4px 18px rgba(192,57,43,0.25)',
                    }}
                  >
                    {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> Posting…</> : 'Post Private Intent'}
                  </button>

                  <p className="text-center text-xs font-sans text-dp-dim leading-relaxed">
                    🔒 Enforced by Canton sub-ledger encryption
                  </p>
                </form>
              </div>

              {/* Right: Intents + Inbox */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                {/* Active Intents */}
                <div className="bg-white border border-dp-border rounded-2xl p-5 shadow-card">
                  <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block mb-4">
                    My Active Intents
                  </span>
                  <div className="flex flex-col gap-3">
                    {intents.map((intent, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-dp-parchment border border-dp-border rounded-xl p-3.5"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-sans font-semibold text-sm text-dp-text">
                              {intent.payload.quantity} {intent.payload.asset}
                            </span>
                            <span
                              className="font-sans text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{
                                color: intent.payload.side === 'BUY' ? '#1A7F4B' : '#C0392B',
                                background: intent.payload.side === 'BUY' ? 'rgba(26,127,75,0.08)' : 'rgba(192,57,43,0.08)',
                              }}
                            >
                              {intent.payload.side}
                            </span>
                          </div>
                          <div className="font-data text-xs text-dp-muted">
                            Limit: ${parseFloat(intent.payload.price).toLocaleString()} · Status:{' '}
                            <span className="text-dp-indigo font-semibold">{intent.payload.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <PrivacyBadge />
                          <ExpiryRing expiryTime={intent.payload.expiry} windowDuration={parseFloat(expirySecs)} />
                        </div>
                      </div>
                    ))}
                    {intents.length === 0 && (
                      <div className="py-8 text-center font-serif italic text-dp-dim text-sm">
                        No active private intents on the ledger.
                      </div>
                    )}
                  </div>
                </div>

                {/* Inbox */}
                <div className="bg-white border border-dp-border rounded-2xl p-5 shadow-card">
                  <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block mb-4">
                    Inbox: Matches & Settlements
                  </span>
                  <div className="flex flex-col gap-3">
                    {proposals.map((prop, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3.5">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-dp-indigo/10 text-dp-indigo font-sans text-xs font-bold px-2 py-0.5 rounded-full">Match Found</span>
                            <span className="font-data text-xs text-dp-dim">#{prop.contractId.slice(0, 10)}</span>
                          </div>
                          <div className="font-sans font-semibold text-sm text-dp-text">
                            {prop.payload.quantity} {prop.payload.asset} @ ${parseFloat(prop.payload.price).toLocaleString()}
                          </div>
                          <div className="font-sans text-xs text-dp-dim mt-0.5">🔒 Counterparty: PRIVATE</div>
                        </div>
                        <div>
                          {role === 'BUYER' ? (
                            <button
                              onClick={() => handleSignProposal(prop.contractId, 'buyer')}
                              className="btn-indigo text-xs px-4 py-2"
                            >Sign as Buyer</button>
                          ) : (
                            <span className="font-sans text-xs text-dp-gold animate-pulse">Awaiting Buyer Sign</span>
                          )}
                        </div>
                      </div>
                    ))}

                    {buyerAccepted.map((prop, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-dp-gold/15 text-dp-gold font-sans text-xs font-bold px-2 py-0.5 rounded-full">Buyer Signed</span>
                            <span className="font-data text-xs text-dp-dim">#{prop.contractId.slice(0, 10)}</span>
                          </div>
                          <div className="font-sans font-semibold text-sm text-dp-text">
                            {prop.payload.quantity} {prop.payload.asset} @ ${parseFloat(prop.payload.price).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          {role === 'SELLER' ? (
                            <button
                              onClick={() => handleSignProposal(prop.contractId, 'seller')}
                              className="btn-indigo text-xs px-4 py-2"
                            >Co-sign as Seller</button>
                          ) : (
                            <span className="font-sans text-xs text-dp-muted">Awaiting Seller</span>
                          )}
                        </div>
                      </div>
                    ))}

                    {settlements.map((prop, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-emerald-100 text-emerald-700 font-sans text-xs font-bold px-2 py-0.5 rounded-full">Ready to Swap</span>
                            <span className="font-data text-xs text-dp-dim">#{prop.contractId.slice(0, 10)}</span>
                          </div>
                          <div className="font-sans font-semibold text-sm" style={{ color: '#1A7F4B' }}>
                            {prop.payload.quantity} {prop.payload.asset} ↔ ${(parseFloat(prop.payload.price) * parseFloat(prop.payload.quantity)).toLocaleString()} USD
                          </div>
                        </div>
                        <div>
                          {role === 'BUYER' ? (
                            <button
                              onClick={() => handleSettleTrade(prop.contractId, prop.payload.buyer, prop.payload.seller, prop.payload.asset)}
                              className="btn-gold text-xs px-4 py-2"
                            >Execute Swap</button>
                          ) : (
                            <span className="font-sans text-xs text-dp-emerald animate-pulse">Awaiting Buyer Settle</span>
                          )}
                        </div>
                      </div>
                    ))}

                    {proposals.length === 0 && buyerAccepted.length === 0 && settlements.length === 0 && (
                      <div className="py-8 text-center font-serif italic text-dp-dim text-sm">
                        No matches or pending settlements.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Trade Log */}
            <div className="bg-white border border-dp-border rounded-2xl p-5 shadow-card mb-4">
              <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block mb-4">
                Settled Trade Log
              </span>
              <div className="overflow-x-auto">
                <table className="dp-table min-w-max w-full">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Action</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRecords.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-6 text-center font-serif italic text-dp-dim">
                        No settled trades. Execute atomic swaps to populate the log.
                      </td>
                    </tr>
                  ) : (
                    auditRecords.map((r, idx) => {
                      const isBuyer = r.payload.buyer.includes(getTraderName());
                      const action = isBuyer ? 'BOUGHT' : 'SOLD';
                      const actionColor = isBuyer ? '#1A7F4B' : '#C0392B';
                      return (
                        <tr key={idx}>
                          <td className="font-sans font-semibold">{r.payload.asset}</td>
                          <td className="font-sans" style={{ color: actionColor }}>{action}</td>
                          <td className="font-data">{parseFloat(r.payload.quantity).toLocaleString()}</td>
                          <td className="font-data">${parseFloat(r.payload.price).toLocaleString()}</td>
                          <td className="font-sans text-dp-muted">{r.payload.timestamp || 'Recently'}</td>
                          <td className="font-sans font-semibold" style={{ color: '#1A7F4B' }}>● Settled</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
            </div>
            </>
            ) : (
            <>
              {/* Private Credit Tab Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white border border-dp-border rounded-2xl p-5 flex flex-col gap-4 shadow-card">
                  <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block">
                    Lock Collateral & Borrow
                    <span className="ml-2 text-sm font-serif italic text-dp-muted font-normal">(private)</span>
                  </span>

                  <form onSubmit={handleRequestLoan} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="label">Collateral Asset</label>
                      <select value={collateralAsset} onChange={e => setCollateralAsset(e.target.value)} className="dp-input dp-select">
                        <option value="BTC">Bitcoin (BTC)</option>
                        <option value="ETH">Ethereum (ETH)</option>
                        <option value="USTB">US Treasury Bill (USTB)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="label">Collateral Amount to Lock</label>
                      <input type="number" step="0.1" value={collateralAmount} onChange={e => setCollateralAmount(e.target.value)} className="dp-input" required />
                    </div>

                    <div className="flex flex-col gap-1.5 mt-2">
                      <label className="label">Loan Asset</label>
                      <select value={loanAsset} onChange={e => setLoanAsset(e.target.value)} className="dp-input dp-select">
                        <option value="USD">USD Cash</option>
                        <option value="USDC">USD Coin</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="label">Loan Amount</label>
                      <input type="number" step="100" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} className="dp-input" required />
                    </div>

                    <button
                      type="submit" disabled={isSubmitting}
                      className="w-full bg-dp-indigo text-white font-display font-semibold text-sm py-3 rounded-xl transition-all shadow-btn hover:bg-dp-indigo/90 mt-2"
                    >
                      {isSubmitting ? 'Requesting...' : 'Submit Confidential Loan Request'}
                    </button>
                    <p className="text-center text-xs font-sans text-dp-dim leading-relaxed">
                      🔒 Your collateral and loan terms are completely hidden from the public orderbook.
                    </p>
                  </form>
                </div>

                <div className="lg:col-span-2 flex flex-col gap-6">
                  {/* Loan Requests */}
                  <div className="bg-white border border-dp-border rounded-2xl p-5 shadow-card">
                    <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block mb-4">
                      My Pending Loan Requests
                    </span>
                    <div className="flex flex-col gap-3">
                      {loanRequests.map((req, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-dp-parchment border border-dp-border rounded-xl p-3.5">
                          <div>
                            <div className="font-sans font-semibold text-sm text-dp-text">
                              Request: {req.payload.loanAmount} {req.payload.loanAsset}
                            </div>
                            <div className="font-data text-xs text-dp-muted">
                              Collateral Locked: {req.payload.collateralAmount} {req.payload.collateralAsset}
                            </div>
                          </div>
                          <span className="font-sans text-xs text-dp-gold animate-pulse">Awaiting Funding</span>
                        </div>
                      ))}
                      {loanRequests.length === 0 && <div className="text-center font-serif italic text-dp-dim text-sm py-4">No pending requests.</div>}
                    </div>
                  </div>

                  {/* Active Loans */}
                  <div className="bg-white border border-dp-border rounded-2xl p-5 shadow-card">
                    <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block mb-4">
                      Active Loans (Funded)
                    </span>
                    <div className="flex flex-col gap-3">
                      {activeLoans.map((loan, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                          <div>
                            <div className="font-sans font-semibold text-sm text-emerald-800">
                              Owe: {loan.payload.loanAmount} {loan.payload.loanAsset}
                            </div>
                            <div className="font-data text-xs text-emerald-600">
                              Collateral Locked: {loan.payload.collateralAmount} {loan.payload.collateralAsset}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRepayLoan(loan.contractId, loan.payload.loanAsset, loan.payload.loanAmount)}
                            className="bg-emerald-600 text-white font-sans text-xs px-4 py-2 rounded-lg shadow-sm hover:bg-emerald-700 transition"
                          >
                            Repay Loan
                          </button>
                        </div>
                      ))}
                      {activeLoans.length === 0 && <div className="text-center font-serif italic text-dp-dim text-sm py-4">No active loans.</div>}
                    </div>
                  </div>
                </div>
              </div>
            </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default TraderDashboard;
