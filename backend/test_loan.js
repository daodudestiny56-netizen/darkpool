const fetch = require('node-fetch');

async function testLoan() {
  try {
    const res = await fetch('http://localhost:5000/api/credit/request-loan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trader: "Bob", marketMaker: "MarketMaker" })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

testLoan();
