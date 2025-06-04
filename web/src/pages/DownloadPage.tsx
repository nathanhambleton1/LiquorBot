import React from 'react';
import './styles/DownloadPage.css';

const DownloadPage: React.FC = () => (
  <div className="download-page lb-container" style={{padding: '4rem 0', textAlign: 'center'}}>
    <h1>Download LiquorBot App</h1>
    <p className="subtitle">Get the official LiquorBot app for your device</p>
    <div className="download-buttons" style={{display: 'flex', justifyContent: 'center', gap: '2rem', margin: '2rem 0'}}>
      <a href="https://apps.apple.com/us/app/liquorbot/id6746461095" target="_blank" rel="noopener noreferrer" className="store-btn">
        <img src="/assets/appstore.png" alt="Download on the App Store" style={{height: 80}} />
      </a>
    </div>
    <div className="download-info" style={{maxWidth: 600, margin: '2rem auto', color: '#cecece'}}>
      <h2>Why use the app?</h2>
      <ul style={{textAlign: 'left', display: 'inline-block', margin: '1rem auto'}}>
        <li>Control your LiquorBot remotely</li>
        <li>Access exclusive cocktail recipes</li>
        <li>Plan and manage events</li>
        <li>Get real-time notifications and updates</li>
      </ul>
      <p style={{marginTop: '2rem'}}>Need help? <a href="/help">Visit our Help Center</a> or <a href="mailto:support@liquorbot.io">contact support</a>.</p>
    </div>
  </div>
);

export default DownloadPage;
