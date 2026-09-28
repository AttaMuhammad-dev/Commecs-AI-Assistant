import { GoogleGenAI } from '@google/genai';
import { FileSearchState, saveState } from './indexState.js';

export async function ensureStore(apiKey: string, state: FileSearchState): Promise<string> {
  if (!state.storeName) {
    const ai = new GoogleGenAI({ apiKey });
    
    console.log("Creating new File Search Store...");
    const store = await ai.fileSearchStores.create({
      config: {
        displayName: 'commecs-knowledge',
        embeddingModel: 'models/gemini-embedding-2'
      }
    });
    
    state.storeName = store.name;
    state.embeddingModel = 'models/gemini-embedding-2';
    saveState(state);
  }
  
  return state.storeName;
}

export async function uploadToFileSearchStore(
  apiKey: string, 
  storeName: string, 
  filePath: string, 
  mimeType: string, 
  displayName: string, 
  customMetadata: any
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  let attempt = 0;
  
  while (attempt < 3) {
    try {
      let operation = await ai.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: storeName, 
        file: filePath,
        config: { 
          displayName: displayName.substring(0, 255), 
          mimeType,
          customMetadata: [
            { key: 'url', stringValue: customMetadata.url || '' },
            { key: 'title', stringValue: customMetadata.title || '' },
            { key: 'slug', stringValue: customMetadata.slug || '' },
            { key: 'modified', stringValue: String(customMetadata.modified || '') },
            { key: 'type', stringValue: customMetadata.type || 'page' },
            { key: 'time_sensitive', numericValue: Number(customMetadata.time_sensitive || 0) }
          ]
        }
      });
      
      const deadline = Date.now() + 180000;
      while (!operation.done) {
        if (Date.now() > deadline) throw new Error("Indexing is still pending. Check the store before retrying to avoid duplicate documents.");
        await new Promise(resolve => setTimeout(resolve, 3000));
        operation = await ai.operations.get({ operation });
      }
      
      if (operation.error) {
        throw new Error(`Indexing failed: ${JSON.stringify(operation.error)}`);
      }
      
      const name = operation.response?.documentName;
      if (!name) throw new Error("Indexing completed without a document resource name. Check the store before retrying.");
      return name;
      
    } catch (err: any) {
      if (attempt < 2 && (err.message?.includes('fetch failed') || err.message?.includes('timeout') || err.message?.includes('socket'))) {
        attempt++; 
        console.warn(`Upload timeout for ${displayName}, retrying (Attempt ${attempt + 1}/3)...`);
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt)); 
        continue;
      }
      throw err;
    }
  }
  
  throw new Error("Upload failed after 3 attempts.");
}