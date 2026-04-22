import fs from 'fs';
import path from 'path';

// /tmp/test_lichess.js
async function test() {
  // Read token from .env.local manually since this is a raw node script
  let token = undefined;
  try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const tokenLine = envContent.split('\n').find(line => line.startsWith('LICHESS_API_TOKEN='));
    if (tokenLine) {
      token = tokenLine.split('=')[1].trim();
    }
  } catch (e) {
    console.log("Could not read .env.local", e.message);
  }

  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const url = `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&moves=5`;
  
  console.log(`Fetching: ${url}`);
  console.log(`Using token: ${token ? 'Found (starts with ' + token.substring(0,4) + '...)' : 'MISSING'}`);
  
  const headers = {
    "Accept": "application/json"
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });

    console.log(`Status: ${response.status}`);
    const text = await response.text();
    
    try {
      const data = JSON.parse(text);
      console.log(JSON.stringify(data, null, 2));
    } catch {
      console.log("NOT JSON. First 200 chars:");
      console.log(text.substring(0, 200));
    }

  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

test();
