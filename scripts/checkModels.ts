import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { getFastLadder, getDeepLadder } from '../server/config/models.js';
async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error('Set GEMINI_API_KEY before checking models.');
  const ai = new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY, httpOptions: { timeout: 15000 }});
  const available = new Set<string>();
  for await (const model of await ai.models.list()) if (model.name) available.add(model.name.replace('models/',''));
  const ids = [...new Set([...getFastLadder(), ...getDeepLadder()])];
  let missing = false;
  for (const id of ids) {
    console.log(id + ': ' + (available.has(id) ? 'AVAILABLE' : 'MISSING'));
    missing ||= !available.has(id);
  }
  console.log('Listing models does not validate File Search, free-tier eligibility or remaining quota. Check AI Studio for project limits.');
  if (missing) process.exitCode = 1;
}
main().catch(() => { console.error('Model listing failed. Check the server API key and connection.'); process.exitCode = 1; });
