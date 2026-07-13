import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { useTradingStore } from '../store/tradingStore';
import { Radio, RefreshCw, Activity, LogOut } from 'lucide-react';
import { parseError } from '../utils/errorHandler';

const MarketMaker = () => {
  const navigate = useNavigate();
  const { address, jwt, disconnect } = useWalletStore();
  const { rfqs, quotes, holdings, fetchData, submitQuote, mintHolding, loanRequests, fundLoan } = useTradingStore();

  const [activeTab, setActiveTab] = useState('rfq');
  const [quotePrices, setQuotePrices] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const updateData = async () => {
    setIsLoading(true);
    await fetchData('MarketMaker', jwt);
    setIsLoading(false);
  };

  useEffect(() => {
    updateData();
    const interval = setInterval(updateData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleQuoteSubmit = async (rfqId, originalLimitPrice) => {
    const quotePrice = quotePrices[rfqId] || originalLimitPrice;
    try {
      showToast(`Submitting quote of $${quotePrice}…`);
      await submitQuote('MarketMaker', rfqId, quotePrice, jwt);
      showToast('Quote submitted successfully.');
      updateData();
    } catch (err) { showToast(`Quote failed: ${parseError(err.message)}`); }
  };

  const handleFaucetMint = async (instrument, amount) => {
    try {
      await mintHolding('MarketMaker', instrument, amount, jwt);
      showToast(`Minted ${amount} ${instrument}`);
      updateData();
    } catch (err) { showToast(`Mint failed: ${parseError(err.message)}`); }
  };

  const handleFundLoan = async (requestId, loanAsset, loanAmount) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const loanHoldings = holdings
        .filter(h => h.payload.instrument === loanAsset && parseFloat(h.payload.amount) >= parseFloat(loanAmount))
        .sort((a, b) => parseFloat(b.payload.amount) - parseFloat(a.payload.amount));
      const loanHolding = loanHoldings[0];
      
      if (!loanHolding) { alert(`You do not have enough ${loanAsset} to fund this loan. Please mint more from the faucet.`); setIsSubmitting(false); return; }
      
      await fundLoan('MarketMaker', requestId, loanHolding.contractId, jwt);
      showToast('Loan Funded Successfully.');
      updateData();
    } catch (err) { showToast(`Funding failed: ${parseError(err.message)}`); }
    finally { setIsSubmitting(false); }
  };

  let usdBal = 0, btcBal = 0;
  holdings.forEach(h => {
    if (h.payload.instrument === 'USD') usdBal += parseFloat(h.payload.amount);
    if (h.payload.instrument === 'BTC') btcBal += parseFloat(h.payload.amount);
  });

  return (
    <div className="flex flex-col min-h-screen bg-dp-parchment">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 toast-slide bg-white border border-dp-border shadow-luxury rounded-2xl px-5 py-3.5 flex items-center gap-3 max-w-xs">
          <Activity size={15} className="text-dp-gold shrink-0" />
          <span className="font-sans text-dp-text text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Navbar */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center px-6 py-3.5 bg-white border-b border-dp-border shadow-sm gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 w-full md:w-auto">
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-display font-bold text-xl text-dp-text cursor-pointer" onClick={() => navigate('/role')}>
              Dark<span className="text-gold">Pool</span>.fi
            </span>
            <span className="bg-dp-violet/10 text-dp-violet font-sans text-xs font-semibold px-2.5 py-0.5 rounded-full border border-dp-violet/20">
              Market Maker Desk
            </span>
          </div>
          <nav className="flex gap-2 md:gap-4 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-hide">
            <button
              onClick={() => setActiveTab('rfq')}
              className={`font-display font-semibold text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${activeTab === 'rfq' ? 'bg-dp-parchment text-dp-text border border-dp-border' : 'text-dp-muted hover:text-dp-text'}`}
            >
              RFQ Exchange
            </button>
            <button
              onClick={() => setActiveTab('credit')}
              className={`font-display font-semibold text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${activeTab === 'credit' ? 'bg-dp-parchment text-dp-text border border-dp-border' : 'text-dp-muted hover:text-dp-text'}`}
            >
              Private Credit Funding
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-data text-xs text-dp-muted bg-dp-parchment border border-dp-border px-3 py-1.5 rounded-full">
            {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''}
          </span>
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
          <div>
            <span className="label block mb-3">MM Desk Balances</span>
            <div className="flex flex-col gap-1">
              {[
                { label: 'USD Cash', value: `$${usdBal.toLocaleString()}`, color: '#1A7F4B' },
                { label: 'BTC Liquidity', value: `${btcBal.toFixed(4)} BTC`, color: '#C89B3C' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-dp-linen transition-colors">
                  <span className="font-sans text-xs text-dp-muted">{label}</span>
                  <span className="font-data text-xs font-semibold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <hr className="sep" />

          <div>
            <span className="label block mb-3">Liquidity Faucet</span>
            <div className="flex flex-col gap-2">
              {[
                ['+ 5 BTC Liquidity', 'BTC', 5.0],
                ['+ $100k USD', 'USD', 100000],
              ].map(([label, instrument, amount]) => (
                <button
                  key={label}
                  onClick={() => handleFaucetMint(instrument, amount)}
                  className="font-sans text-xs font-medium py-2.5 px-3 rounded-lg bg-dp-parchment border border-dp-border hover:border-dp-gold/60 hover:bg-dp-gold/5 text-dp-muted hover:text-dp-gold transition-all text-left"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
          <div className="flex justify-between items-center border-b border-dp-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-dp-violet/10 flex items-center justify-center">
                <Radio size={18} className="text-dp-violet" />
              </div>
              <div>
                <h1 className="font-display font-bold text-2xl text-dp-text">
                  {activeTab === 'rfq' ? 'RFQ Listings Feed' : 'Private Credit Desk'}
                </h1>
                <p className="font-sans text-xs text-dp-muted">
                  {activeTab === 'rfq' ? 'Anonymous requests for quote from traders' : 'Fund trader collateralized loan requests'}
                </p>
              </div>
            </div>
            <button
              onClick={updateData}
              className="flex items-center gap-2 font-sans text-xs text-dp-muted hover:text-dp-indigo border border-dp-border rounded-full px-3 py-1.5 hover:border-dp-indigo/40 transition-all"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-6">
            {activeTab === 'rfq' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Open RFQs */}
              <div className="bg-white border border-dp-border rounded-2xl p-5 shadow-card">
                <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block mb-4">
                  Open RFQ Broadcasts
                </span>
                <div className="flex flex-col gap-3">
                  {rfqs.map((rfq, idx) => (
                    <div key={idx} className="bg-dp-parchment border border-dp-border rounded-xl p-4">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="bg-dp-gold/15 text-dp-gold font-sans text-xs font-bold px-2 py-0.5 rounded-full">RFQ OPEN</span>
                            <span className="font-data text-xs text-dp-dim">#{rfq.contractId.slice(0, 10)}</span>
                          </div>
                          <div className="font-sans text-sm">
                            <span className="font-semibold text-dp-text">{rfq.payload.asset}</span>
                            {' · '}
                            <span
                              className="font-semibold"
                              style={{ color: rfq.payload.side === 'BUY' ? '#1A7F4B' : '#C0392B' }}
                            >
                              {rfq.payload.side}
                            </span>
                            {' · '}
                            <span className="text-dp-muted">{rfq.payload.quantity} units</span>
                          </div>
                          <div className="font-data text-xs text-dp-dim">
                            Trader Limit: ${parseFloat(rfq.payload.price).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <label className="label text-dp-dim">Your Quote ($)</label>
                          <input
                            type="number"
                            step="1"
                            placeholder={rfq.payload.price}
                            value={quotePrices[rfq.contractId] || ''}
                            onChange={e => setQuotePrices(p => ({ ...p, [rfq.contractId]: e.target.value }))}
                            className="dp-input w-28 text-right font-data text-sm py-2 px-3"
                          />
                          <button
                            onClick={() => handleQuoteSubmit(rfq.contractId, rfq.payload.price)}
                            className="btn-gold text-xs px-4 py-2"
                          >
                            Submit Quote
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {rfqs.length === 0 && (
                    <div className="py-10 text-center font-serif italic text-dp-dim text-sm">
                      No open RFQ broadcasts.<br />
                      <span className="text-xs not-italic">Intents graduate here dynamically when they expire unmatched.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Quotes */}
              <div className="bg-white border border-dp-border rounded-2xl p-5 shadow-card">
                <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block mb-4">
                  My Quoted Offers
                </span>
                <div className="flex flex-col gap-3">
                  {quotes.map((quote, idx) => (
                    <div key={idx} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="bg-emerald-100 text-emerald-700 font-sans text-xs font-bold px-2 py-0.5 rounded-full">QUOTED</span>
                            <span className="font-data text-xs text-dp-dim">#{quote.contractId.slice(0, 10)}</span>
                          </div>
                          <div className="font-sans text-sm">
                            <span className="font-semibold text-dp-text">{quote.payload.quantity} {quote.payload.asset}</span>
                            {' @ '}
                            <span className="font-data font-semibold text-dp-gold">${parseFloat(quote.payload.price).toLocaleString()}</span>
                          </div>
                        </div>
                        <span className="font-sans text-xs text-dp-muted animate-pulse">Awaiting trader accept…</span>
                      </div>
                    </div>
                  ))}
                  {quotes.length === 0 && (
                    <div className="py-10 text-center font-serif italic text-dp-dim text-sm">
                      No active quotes submitted.
                    </div>
                  )}
                </div>
              </div>
            </div>
            ) : (
              <div className="bg-white border border-dp-border rounded-2xl p-5 shadow-card max-w-4xl">
                <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block mb-4">
                  Pending Loan Requests
                </span>
                <div className="flex flex-col gap-3">
                  {loanRequests.map((req, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-dp-parchment border border-dp-border rounded-xl p-4 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-dp-indigo/10 text-dp-indigo font-sans text-xs font-bold px-2 py-0.5 rounded-full">LOAN REQUEST</span>
                          <span className="font-data text-xs text-dp-dim">#{req.contractId.slice(0, 10)}</span>
                        </div>
                        <div className="font-sans text-sm">
                          <span className="font-semibold text-dp-text">Requesting {req.payload.loanAmount} {req.payload.loanAsset}</span>
                        </div>
                        <div className="font-data text-xs text-dp-muted mt-1">
                          Collateral locked: {req.payload.collateralAmount} {req.payload.collateralAsset}
                        </div>
                      </div>
                      <button
                        onClick={() => handleFundLoan(req.contractId, req.payload.loanAsset, req.payload.loanAmount)}
                        disabled={isSubmitting}
                        className={`btn-indigo text-xs px-5 py-2 whitespace-nowrap ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isSubmitting ? 'Funding...' : `Fund Loan (${req.payload.loanAmount} ${req.payload.loanAsset})`}
                      </button>
                    </div>
                  ))}
                  {loanRequests.length === 0 && (
                    <div className="py-10 text-center font-serif italic text-dp-dim text-sm">
                      No pending loan requests from traders.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MarketMaker;
