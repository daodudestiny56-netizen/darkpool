import Buffer from 'buffer';

// Map of user-friendly names to actual ledger party IDs
export const partyMap = {
  Alice: '',
  Bob: '',
  Carol: '', // Regulator
  MatchEngine: '',
  MarketMaker: '',
  Custodian: ''
};

// Generates an unsigned/mock JWT token for the JSON API (supports single party or array of parties)
export function generateToken(partyIdOrList) {
  const partiesList = Array.isArray(partyIdOrList) ? partyIdOrList : [partyIdOrList];
  
  const header = JSON.stringify({ alg: "HS256", typ: "JWT" });
  const payload = JSON.stringify({
    "https://daml.com/ledger-api": {
      "ledgerId": "sandbox",
      "applicationId": "darkpool",
      "actAs": partiesList,
      "readAs": partiesList
    }
  });
  
  const b64Header = Buffer.Buffer.from(header).toString('base64url');
  const b64Payload = Buffer.Buffer.from(payload).toString('base64url');
  
  return `${b64Header}.${b64Payload}.dummy_signature`;
}

// Function to allocate a party on the ledger
export async function allocateParty(jsonApiUrl, name) {
  try {
    const token = generateToken(name);
    const res = await fetch(`${jsonApiUrl}/v2/parties/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        partyIdHint: name,
        displayName: name
      })
    });
    
    const data = await res.json();
    if (res.ok && data.result) {
      console.log(`[Ledger] Successfully allocated party '${name}':`, data.result.identifier);
      return data.result.identifier;
    } else {
      console.warn(`[Ledger] Party allocation response for '${name}':`, data);
    }
  } catch (err) {
    console.error(`[Ledger] Error allocating party '${name}':`, err.message);
  }
  return name; // Fallback
}

// Function to resolve party mappings from the ledger
export async function resolveParties(jsonApiUrl) {
  try {
    const token = generateToken('MatchEngine');
    const res = await fetch(`${jsonApiUrl}/v2/parties`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!res.ok) {
      console.warn('Failed to fetch parties list from JSON API.');
    } else {
      const data = await res.json();
      if (data.result && Array.isArray(data.result)) {
        for (const p of data.result) {
          const displayName = p.displayName || '';
          const identifier = p.identifier;
          
          if (displayName.includes('Alice')) partyMap.Alice = identifier;
          else if (displayName.includes('Bob')) partyMap.Bob = identifier;
          else if (displayName.includes('Carol')) partyMap.Carol = identifier;
          else if (displayName.includes('MatchEngine')) partyMap.MatchEngine = identifier;
          else if (displayName.includes('MarketMaker')) partyMap.MarketMaker = identifier;
          else if (displayName.includes('Custodian')) partyMap.Custodian = identifier;
        }
      }
    }
    
    // Allocate any parties that could not be resolved from the ledger
    for (const key of Object.keys(partyMap)) {
      if (!partyMap[key]) {
        console.log(`[Ledger] Party '${key}' not found. Allocating...`);
        partyMap[key] = await allocateParty(jsonApiUrl, key);
      }
    }
    
    console.log('Resolved Party Mapping:', partyMap);
  } catch (err) {
    console.error('Error resolving parties:', err.message);
    // Fallback to name keys
    Object.keys(partyMap).forEach(key => {
      partyMap[key] = key;
    });
  }
}
