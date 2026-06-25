import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { db } from './firebase';
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';

// Test connection on startup as per guidelines
async function testConnection() {
  try {
    // Attempt to fetch a dummy doc from server
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error.message?.includes('offline') || error.message?.includes('permission-denied')) {
      console.warn("Firebase connection status:", error.message);
    }
  }
}

testConnection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
