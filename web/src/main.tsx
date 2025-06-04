// -----------------------------------------------------------------------------
// File: main.tsx   (LiquorBot Web – Home page + Auth)
// -----------------------------------------------------------------------------
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// ✅ Amplify setup
import { Amplify } from 'aws-amplify';
import awsconfig from './amplifyconfiguration.json';
Amplify.configure(awsconfig);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
