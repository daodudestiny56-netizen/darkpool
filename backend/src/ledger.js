import { generateToken } from './parties.js';
import { execSync } from 'child_process';
import path from 'path';

const JSON_API_URL = process.env.JSON_API_URL || 'http://localhost:7575';
let cachedPackageId = null;

// Dynamically resolve package ID by running damlc inspect-dar
export function getPackageId() {
  if (cachedPackageId) return cachedPackageId;
  
  try {
    const projectDir = 'c:/Users/USER/Desktop/canton/daml';
    const darPath = path.join(projectDir, '.daml/dist/darkpool-1.0.0.dar');
    const envPath = 'C:\\Users\\USER\\Desktop\\canton\\jdk17\\jdk-17.0.19+10\\bin;C:\\Users\\USER\\Desktop\\canton\\bin;' + process.env.PATH;
    const cmd = `daml damlc inspect-dar --json "${darPath}"`;
    
    console.log('[Ledger] Resolving package ID from DAR...');
    const stdout = execSync(cmd, {
      env: { ...process.env, PATH: envPath, DAML_HOME: 'C:\\Users\\USER\\Desktop\\canton' }
    }).toString();
    
    const darInfo = JSON.parse(stdout);
    const packages = darInfo.packages;
    for (const pid of Object.keys(packages)) {
      if (packages[pid].name === 'darkpool') {
        cachedPackageId = pid;
        console.log(`[Ledger] Resolved 'darkpool' package ID: ${pid}`);
        return pid;
      }
    }
  } catch (err) {
    console.warn('[Ledger] Failed to resolve package ID dynamically:', err.message);
  }
  
  // Fallback
  return '8a9cdf3d31f962781d9fbb256caec8d93d9aa980ff5aa8fd3b01f125e8838464';
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
