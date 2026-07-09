import { generateToken } from './parties.js';
import { execSync } from 'child_process';
import path from 'path';

const JSON_API_URL = process.env.CANTON_URL || 'http://localhost:7575';
const PACKAGE_ID = "76c6acbcb3ebde7e60126dd183c00a89c07ad8e6162f4abbda99e6c0cb17d7f7";

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
  const url = `${JSON_API_URL}${endpoint}`;
  
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
    
    return data.result;
  } catch (err) {
    console.error(`Ledger API request failed [${endpoint}] for party ${party}:`, err.message);
    throw err;
  }
}

export async function createContract(party, shortTemplateId, payload) {
  const templateId = getFullTemplateId(shortTemplateId);
  return await request(party, '/v2/create', {
    templateId,
    payload
  });
}

export async function exerciseChoice(party, shortTemplateId, contractId, choice, argument = {}) {
  const templateId = getFullTemplateId(shortTemplateId);
  return await request(party, '/v2/exercise', {
    templateId,
    contractId,
    choice,
    argument
  });
}

export async function queryContracts(party, shortTemplateId) {
  const templateId = getFullTemplateId(shortTemplateId);
  return await request(party, '/v2/query', {
    templateIds: [templateId]
  });
}
