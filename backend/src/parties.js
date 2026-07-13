import crypto from 'crypto';

export const JWT_SECRET = process.env.JWT_SECRET || 'darkpool_dev_secret_key_12345';

export const partyMap = {
  Alice:       process.env.ALICE_PARTY       || 'Alice',
  Bob:         process.env.BOB_PARTY         || 'Bob', 
  Carol:       process.env.CAROL_PARTY       || 'Carol',
  MatchEngine: process.env.MATCH_ENGINE_PARTY || 'MatchEngine',
  MarketMaker: process.env.MARKET_MAKER_PARTY || 'MarketMaker',
  Custodian:   process.env.CUSTODIAN_PARTY   || 'Custodian',
};

// Generates a securely signed JWT token for the JSON API using native crypto
export function generateToken(partyIdOrList) {
  const partiesList = Array.isArray(partyIdOrList) ? partyIdOrList : [partyIdOrList];
  
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    "https://daml.com/ledger-api": {
      "ledgerId": "sandbox",
      "applicationId": "darkpool",
      "actAs": partiesList,
      "readAs": partiesList
    }
  };
  
  const base64url = (str) => Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${signatureInput}.${signature}`;
}

export async function allocateParty(jsonApiUrl, name) {
  try {
    const token = generateToken("participant_admin");
    
    const getRes = await fetch(`${jsonApiUrl}/v1/parties`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const getBody = await getRes.json();
    if (getBody.status === 200) {
      const existing = getBody.result.find(p => p.identifier.startsWith(name + '::') || p.identifier === name);
      if (existing) {
        return existing.identifier;
      }
    }

    const res = await fetch(`${jsonApiUrl}/v1/parties/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ identifierHint: name })
    });
    const data = await res.json();
    if (data.status === 200) {
      console.log(`[Ledger] Successfully allocated party for ${name}: ${data.result.identifier}`);
      return data.result.identifier;
    }
  } catch (e) {
    console.warn(`[Ledger] Party allocation error for ${name}:`, e.message);
  }
  
  console.warn(`[Ledger] Dynamic allocation fallback used for '${name}'.`);
  return name;
}

export async function resolveParties(jsonApiUrl) {
  for (const [key, val] of Object.entries(partyMap)) {
    if (!val.includes('::')) {
      partyMap[key] = await allocateParty(jsonApiUrl, val);
    }
  }
  console.log('Resolved Party Mapping:', partyMap);
}
