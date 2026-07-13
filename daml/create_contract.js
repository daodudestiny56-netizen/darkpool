const fs = require('fs');

async function run() {
  const token = fs.readFileSync('token.txt', 'utf8').trim();
  const payload = JSON.parse(fs.readFileSync('payload.json', 'utf8'));

  try {
    const res = await fetch('https://json-api.validator.devnet.sandbox.fivenorth.io/v1/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (e) {
    console.error("Error:", e);
  }
}

run();
