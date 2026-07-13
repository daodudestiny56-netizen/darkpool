export function parseError(errMessage) {
  if (!errMessage) return 'An unknown error occurred.';
  const msg = errMessage.toString();
  
  if (msg.includes('Buyer holding insufficient funds')) {
    return 'You do not have enough funds for this transaction. Please mint more funds from the Faucet.';
  }
  if (msg.includes('Seller holding insufficient funds')) {
    return 'The counterparty does not have enough funds to complete this trade.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('Network Error')) {
    return 'Could not connect to the server. Please ensure the backend is running.';
  }
  if (msg.includes('Ledger is still initializing')) {
    return 'The system is still starting up. Please wait a moment and try again.';
  }
  if (msg.includes('Unauthorized party impersonation')) {
    return 'You are not authorized to perform this action.';
  }
  if (msg.includes('requirement failed:')) {
    // Extract the specific requirement failure message
    const match = msg.match(/requirement failed: (.*?)(?:\n|$)/);
    if (match) return match[1];
  }
  if (msg.includes('INVALID_ARGUMENT:')) {
    return 'The transaction failed due to invalid inputs.';
  }
  if (msg.includes('CONTRACT_NOT_FOUND')) {
    return 'A required holding or contract is missing (likely already spent or cancelled). This request cannot be fulfilled.';
  }
  
  return msg;
}
