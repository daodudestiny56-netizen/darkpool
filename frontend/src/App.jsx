import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Shell from './components/layout/Shell';
import Landing from './pages/Landing';
import Connect from './pages/Connect';
import RoleSelect from './pages/RoleSelect';
import TraderDashboard from './pages/TraderDashboard';
import AuditorDashboard from './pages/AuditorDashboard';
import MarketMaker from './pages/MarketMaker';
import { useWalletStore } from './store/walletStore';
import { useTradingStore } from './store/tradingStore';

const PrivateRoute = ({ children, requireRole }) => {
  const { address } = useWalletStore();
  const { role } = useTradingStore();

  if (!address) {
    return <Navigate to="/" replace />;
  }
  
  if (requireRole && !role) {
    return <Navigate to="/role" replace />;
  }

  return children;
};

function App() {
  const { reconnect } = useWalletStore();

  useEffect(() => {
    // Attempt automatic session restoration
    reconnect();
  }, []);

  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/role" element={
            <PrivateRoute>
              <RoleSelect />
            </PrivateRoute>
          } />
          <Route path="/trade" element={
            <PrivateRoute requireRole>
              <TraderDashboard />
            </PrivateRoute>
          } />
          <Route path="/auditor" element={
            <PrivateRoute>
              <AuditorDashboard />
            </PrivateRoute>
          } />
          <Route path="/market-maker" element={
            <PrivateRoute>
              <MarketMaker />
            </PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}

export default App;
