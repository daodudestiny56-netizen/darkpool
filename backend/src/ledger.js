import { generateToken } from './parties.js';
import { execSync } from 'child_process';
import path from 'path';


const PACKAGE_ID = "8014f10575db230e3849e49f519f22bacee5091a4063d71ee2eb077b9172ad28";

export function getPackageId() {
  return PACKAGE_ID;
}

// Map short template name to fully qualified template ID
export function getFullTemplateId(shortName) {
  const pkgId = getPackageId();
  return `${pkgId}:${shortName}`;
}

// Helper to make API requests
async function request(party, endpoint, body) {
  const token = generateToken(party);
  const url = `${process.env.CANTON_URL}${endpoint}`;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errors ? data.errors.join(', ') : `HTTP error ${res.status}`);
    }
    
    return data.result !== undefined ? data.result : (endpoint === '/v1/query' ? [] : {});
  } catch (err) {
    console.error(`Ledger API request failed [${endpoint}] for party ${party}:`, err.message);
    throw err;
  }
}

export async function createContract(party, shortTemplateId, payload) {
  const templateId = getFullTemplateId(shortTemplateId);
  return await request(party, '/v1/create', {
    templateId,
    payload
  });
}

export async function exerciseChoice(party, shortTemplateId, contractId, choice, argument = {}) {
  const templateId = getFullTemplateId(shortTemplateId);
  return await request(party, '/v1/exercise', {
    templateId,
    contractId,
    choice,
    argument
  });
}

export async function queryContracts(party, shortTemplateId) {
  const templateId = getFullTemplateId(shortTemplateId);
  return await request(party, '/v1/query', {
    templateIds: [templateId]
  });
}
