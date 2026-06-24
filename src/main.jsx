import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initStorage } from './storage';
import './index.css';

const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
};

initStorage().then(() => {
  registerServiceWorker();
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
