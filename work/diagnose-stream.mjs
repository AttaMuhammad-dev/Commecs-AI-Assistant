import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { generateChatStream } from './runtime/server/gemini.js';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
try {
    const result = await generateChatStream('tell me about the faculty of commecs which teaches urdu subject?', [], AbortSignal.timeout(55000), 'fast', () => { }, () => { }, undefined, async (params) => {
        try {
            return await ai.models.generateContentStream(params);
        }
        catch (e) {
            let msg = String(e.message);
            for (const v of [process.env.GEMINI_API_KEY, process.env.FILE_SEARCH_STORE_NAME])
                if (v)
                    msg = msg.split(v).join('[redacted]');
            console.log(JSON.stringify({ status: e.status, message: msg }));
            throw e;
        }
    });
    console.log(JSON.stringify({ finish: result.finishReason, sources: result.sources.length, model: result.model, length: result.text.length }));
}
catch (e) {
    console.log({ code: e.code, message: e.message });
    process.exitCode = 1;
}
