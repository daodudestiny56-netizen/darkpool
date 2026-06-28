import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { useTradingStore } from '../store/tradingStore';
import { Shield, RefreshCw, BarChart3, Lock, LogOut, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API_URL = 'http://localhost:5000';

const CHART_COLORS = ['#C89B3C', '#3D3B8E', '#1A7F4B', '#7C4DFF', '#C0392B'];

const PrivacyProofWidget = ({ jwt }) => {
  const [lines, setLines] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | running | pass | fail

  const runProof = async () => {
    setIsRunning(true);
    setStatus('running');
    setLines(['$ GET /v1/query { "templateIds": ["TradeIntent"] } as Carol', 'Connecting to Canton Ledger…']);
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    await sleep(700);
    setLines(p => [...p, 'Authorized as: Carol (Auditor / Regulator)']);
    await sleep(500);
    setLines(p => [...p, 'Scanning Active Contract Set (ACS)…']);

    try {
      const res = await fetch(`${API_URL}/api/intents?party=Carol`, { headers: { Authorization: `Bearer ${jwt}` } });
      if (res.ok) {
        const intents = await res.json();
        await sleep(700);
        setLines(p => [...p, `HTTP 200 OK · ${intents.length} contracts returned.`]);
        await sleep(500);
        if (intents.length === 0) {
          setLines(p => [...p, '──────────────────────────────', '[PRIVACY PROOF] PASSED ✓', 'Sub-ledger security verified.', 'Carol has ZERO visibility into active intents.']);
          setStatus('pass');
        } else {
          setLines(p => [...p, '──────────────────────────────', '[PRIVACY PROOF] FAILED ✗', 'Carol can read active trader intents!']);
          setStatus('fail');
        }
      } else { throw new Error('API error'); }
    } catch (err) {
      setLines(p => [...p, `[ERROR] ${err.message}`]);
      setStatus('fail');
    } finally { setIsRunning(false); }
  };

  return (
    <div className="bg-white border border-dp-border rounded-2xl p-5 shadow-card flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2 border-b border-dp-border pb-3">
        <Lock size={15} className="text-dp-indigo" />
        <span className="font-display font-semibold text-dp-text">Privacy Verification</span>
      </div>
      <p className="font-sans text-sm text-dp-muted leading-relaxed">
        Verify that Carol (Regulator) cannot inspect Alice or Bob's private TradeIntents. Canton sub-ledger privacy must prevent this access.
      </p>

      {/* Console output */}
      <div className="bg-dp-indigo rounded-xl p-4 font-data text-xs flex flex-col gap-1 min-h-[180px] overflow-y-auto">
        {lines.length === 0 ? (
          <span className="text-white/30 italic m-auto">Terminal idle — press run to verify</span>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('$') ? 'text-dp-gold-light' :
                line.includes('PASSED') ? 'text-emerald-300 font-bold' :
                line.includes('FAILED') || line.includes('ERROR') ? 'text-red-300 font-bold' :
                'text-white/70'
              }
            >
              {line}
            </div>
          ))
        )}
      </div>

      <button
        onClick={runProof}
        disabled={isRunning}
        className={`w-full font-sans font-semibold text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
          status === 'pass'
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            : 'btn-indigo'
        }`}
      >
        {isRunning ? <><Loader2 size={15} className="animate-spin" /> Verifying…</> :
         status === 'pass' ? 'Privacy Proof Passed ✓' : 'Run Privacy Verification'}
      </button>
    </div>
  );
};

const AuditorDashboard = () => {
  const navigate = useNavigate();
  const { address, jwt, disconnect } = useWalletStore();
  const { auditRecords, fetchData } = useTradingStore();
  const [isLoading, setIsLoading] = useState(false);

  const updateData = async () => {
    setIsLoading(true);
    await fetchData('Carol', jwt);
    setIsLoading(false);
  };

  useEffect(() => {
    updateData();
    const interval = setInterval(updateData, 4000);
    return () => clearInterval(interval);
  }, []);

  let totalBtcVolume = 0, totalUsdNotional = 0;
  const chartDataMap = {};
  for (const r of auditRecords) {
    const qty = parseFloat(r.payload.quantity);
    const price = parseFloat(r.payload.price);
    const asset = r.payload.asset;
    const notional = qty * price;
    totalUsdNotional += notional;
    if (asset === 'BTC') totalBtcVolume += qty;
    chartDataMap[asset] = (chartDataMap[asset] || 0) + notional;
  }
  const chartData = Object.keys(chartDataMap).map(k => ({ name: k, value: chartDataMap[k] }));
  if (chartData.length === 0) chartData.push({ name: 'USTB', value: 100000 });

  return (
    <div className="flex flex-col min-h-screen bg-dp-parchment">
      {/* Navbar */}
      <header className="flex justify-between items-center px-6 py-3.5 bg-white border-b border-dp-border shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-xl text-dp-text cursor-pointer" onClick={() => navigate('/role')}>
            Dark<span className="text-gold">Pool</span>.fi
          </span>
          <span className="bg-dp-indigo/10 text-dp-indigo font-sans text-xs font-semibold px-2.5 py-0.5 rounded-full border border-dp-indigo/20">
            Regulator View
          </span>
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

      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Title row */}
        <div className="flex justify-between items-center border-b border-dp-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-dp-indigo/10 flex items-center justify-center">
              <Shield size={20} className="text-dp-indigo" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-dp-text">Regulatory Compliance</h1>
              <p className="font-sans text-xs text-dp-muted mt-0.5">Post-trade audit trail for Carol the Regulator</p>
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

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Settled Trades', value: `${auditRecords.length} trades`, color: '#C89B3C', Icon: BarChart3 },
            { label: 'BTC Volume', value: `${totalBtcVolume.toFixed(4)} BTC`, color: '#1A7F4B', Icon: BarChart3 },
            { label: 'Total Notional Value', value: `$${totalUsdNotional.toLocaleString()} USD`, color: '#3D3B8E', Icon: BarChart3 },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="bg-white border border-dp-border rounded-2xl p-4 shadow-card flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}14` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <span className="label block mb-0.5">{label}</span>
                <span className="font-data font-semibold text-sm" style={{ color }}>{value}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left: table + chart */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            {/* Audit trail table */}
            <div className="bg-white border border-dp-border rounded-2xl p-5 shadow-card">
              <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block mb-4">
                Post-Trade Audit Trail
              </span>
              <div className="overflow-x-auto">
                <table className="dp-table">
                  <thead>
                    <tr>
                      <th>Audit ID</th><th>Asset</th><th>Buyer</th><th>Seller</th>
                      <th>Qty</th><th>Price</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRecords.map((r, idx) => (
                      <tr key={idx}>
                        <td className="font-data text-dp-dim">#{r.contractId.slice(0, 10)}</td>
                        <td className="font-sans font-semibold text-dp-text">{r.payload.asset}</td>
                        <td className="font-data text-dp-muted">{r.payload.buyer.slice(0, 12)}…</td>
                        <td className="font-data text-dp-muted">{r.payload.seller.slice(0, 12)}…</td>
                        <td className="font-data">{r.payload.quantity}</td>
                        <td className="font-data">${parseFloat(r.payload.price).toLocaleString()}</td>
                        <td className="font-sans font-semibold text-emerald-600">● Settled</td>
                      </tr>
                    ))}
                    {auditRecords.length === 0 && (
                      <tr><td colSpan="7" className="py-8 text-center font-serif italic text-dp-dim">
                        No compliance records yet. Execute atomic swaps on the trader desk first.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white border border-dp-border rounded-2xl p-5 shadow-card">
              <span className="font-display font-semibold text-lg text-dp-text border-b border-dp-border pb-3 block mb-4">
                Settled Notional by Asset
              </span>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#A69880" fontSize={11} fontFamily="DM Sans" />
                    <YAxis stroke="#A69880" fontSize={11} fontFamily="DM Sans" />
                    <Tooltip
                      contentStyle={{ background: '#FAF8F3', border: '1px solid #D4C9B0', borderRadius: 10, fontFamily: 'DM Sans' }}
                      labelStyle={{ color: '#1A1510', fontWeight: 600 }}
                      itemStyle={{ color: '#C89B3C' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={44}>
                      {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Privacy Proof */}
          <div className="xl:col-span-1">
            <PrivacyProofWidget jwt={jwt} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuditorDashboard;
