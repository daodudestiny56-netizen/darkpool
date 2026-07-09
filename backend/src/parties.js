import Buffer from 'buffer';

export const partyMap = {
  Alice:       process.env.ALICE_PARTY       || 'Alice',
  Bob:         process.env.BOB_PARTY         || 'Bob', 
  Carol:       process.env.CAROL_PARTY       || 'Carol',
  MatchEngine: process.env.MATCH_ENGINE_PARTY || 'MatchEngine',
  MarketMaker: process.env.MARKET_MAKER_PARTY || 'MarketMaker',
  Custodian:   process.env.CUSTODIAN_PARTY   || 'Custodian',
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

export async function allocateParty(jsonApiUrl, name) {
  console.warn(`[Ledger] Dynamic allocation disabled on DevNet for '${name}'. Using fallback.`);
  return name;
}

export async function resolveParties(jsonApiUrl) {
  console.log('Using Hardcoded Party Mapping:', partyMap);
}
