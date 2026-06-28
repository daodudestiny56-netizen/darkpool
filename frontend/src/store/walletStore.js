import { create } from 'zustand';
import { BrowserProvider } from 'ethers';

const API_URL = 'http://localhost:5000';

export const useWalletStore = create((set, get) => ({
  address: null,
  provider: null,
  partyId: null,
  jwt: null,
  isConnecting: false,
  error: null,

  connect: async (walletType = 'metamask', manualAddress = '') => {
    set({ isConnecting: true, error: null });
    try {
      let address = '';
      let provider = null;

      if (manualAddress) {
        // Manual/Demo mode
        address = manualAddress;
      } else if (walletType === 'metamask') {
        if (!window.ethereum) {
          throw new Error('MetaMask is not installed. Please install it or use the Manual input fallback.');
        }
        provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        address = await signer.getAddress();
      } else {
        throw new Error('Unsupported connection type');
      }

      // Call Express backend to resolve address to Canton Party ID and JWT Token
      const res = await fetch(`${API_URL}/api/auth/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to authenticate on ledger');
      }

      const { partyId, token } = await res.json();

      set({
        address,
        provider: provider ? true : null, // Store simple flag or provider helper
        partyId,
        jwt: token,
        isConnecting: false
      });

      // Cache session in localStorage (excluding JWT token for security)
      localStorage.setItem('dp_address', address);
      localStorage.setItem('dp_partyId', partyId);
    } catch (err) {
      console.error('[WalletStore] Connection failed:', err.message);
      set({ error: err.message, isConnecting: false });
    }
  },

  disconnect: () => {
    set({ address: null, provider: null, partyId: null, jwt: null });
    localStorage.removeItem('dp_address');
    localStorage.removeItem('dp_partyId');
  },

  reconnect: async () => {
    const cachedAddress = localStorage.getItem('dp_address');
    if (cachedAddress) {
      // Automatically reconnect session
      await get().connect('manual', cachedAddress);
    }
  }
}));
