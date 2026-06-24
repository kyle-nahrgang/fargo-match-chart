import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initStorage, registerStorageLifecycleHooks } from './storage';
import './index.css';

const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  } catch (error) {
    console.warn('Service worker registration failed:', error);
  }
};

const bootstrap = async () => {
  await registerServiceWorker();
  await initStorage();
  registerStorageLifecycleHooks();

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

void bootstrap();
