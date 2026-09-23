import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/index.css';
import './styles/header.css';
import './styles/reference_homepage.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Progressive Web App (PWA) Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[NCC PWA] Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('[NCC PWA] Service Worker registration failed:', error);
      });
  });
}
