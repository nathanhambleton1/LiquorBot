// -----------------------------------------------------------------------------
// File: App.tsx   (LiquorBot Web – Home page + Auth)
// -----------------------------------------------------------------------------

import React, { useState, useEffect, } from 'react';
import {
  Authenticator,
  ThemeProvider,
  type Theme,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './App.css';
import { Amplify } from 'aws-amplify';
import awsconfig from './amplifyconfiguration.json';
import { FiLogOut } from 'react-icons/fi';
import { Hub } from '@aws-amplify/core';
import { getCurrentUser, signOut } from 'aws-amplify/auth';

Amplify.configure(awsconfig);

/* -------------------------------------------------------------------------- */
/*                               THEME OVERRIDE                               */
/* -------------------------------------------------------------------------- */
/**
 *  ⚠️  Important:  Leave the object **un-annotated** (or cast with `as Theme`)
 *  so that only the tokens you specify are checked.  Amplify UI will merge
 *  anything you omit with its own default theme at runtime.
 */
const liquorTheme: Theme = {
  name: 'liquorTheme',
  tokens: {
    colors: {
      background: {
        primary: { value: '#141414' },
      },
      font: {
        primary: { value: '#DFDCD9' },
      },
      brand: {
        primary: {
          /* keys must be strings → '10', '80', …  */
          '10':  { value: '#CE975E' },
          '80':  { value: '#CE975E' },
          '90':  { value: '#CE975E' },
          '100': { value: '#CE975E' },
        },
      },
    },
  },
};

/* -------------------------------------------------------------------------- */
/*                             UTILITY COMPONENTS                             */
/* -------------------------------------------------------------------------- */

const SiteHeader: React.FC<{ onShowAuth: () => void; user: any; signOut: () => void;}> = ({ onShowAuth, user, signOut }) => {

  return (
    <header className="lb-header">
      <div className="lb-container">
        {/* Logo + word-mark */}
        <div className="lb-logo" onClick={() => window.scrollTo(0, 0)}>
          <img src="../assets/logo.png" alt="LiquorBot" />
          <span>LiquorBot</span>
        </div>

        {/* Simple anchor-based nav */}
        <nav>
          <a href="#features">Features</a>
          <a href="#help">Help</a>
          <a href="#contact">Contact</a>
        </nav>

        {/* Auth CTA */}
        {user ? (
          <button className="lb-btn" onClick={signOut}>
            <FiLogOut style={{ marginRight: 6 }} />
            Sign&nbsp;Out
          </button>
        ) : (
          <button className="lb-btn" onClick={onShowAuth}>
            Sign&nbsp;In
          </button>
        )}
      </div>
    </header>
  );
};

const Hero: React.FC = () => (
  <section className="lb-hero">
    <div className="lb-container hero-inner">
      <h1>
        Your Personal&nbsp;<span className="accent">Robotic Bartender</span>
      </h1>
      <p>
        LiquorBot mixes perfect cocktails on demand, tracks your favorites and
        keeps the party flowing — all from the convenience of our companion app.
      </p>

      <div className="cta-row">
        {/* Replace with real store URLs */}
        <a className="store-btn" href="#">
          <img src="../assets/appstore.png" alt="Download on the App Store" />
        </a>
        <a className="store-btn" href="#">
          <img src="../assets/googleplay.png" alt="Get it on Google Play" />
        </a>
      </div>
    </div>
  </section>
);

const Features: React.FC = () => {
  const cards = [
    {
      title: 'Smart Pouring',
      copy: 'Precision pumps and sensors craft bar-quality drinks in seconds.',
      icon: '🍹',
    },
    {
      title: 'Custom Recipes',
      copy: 'Design and save your own mixes — complete with a generated drink image.',
      icon: '✨',
    },
    {
      title: 'Anytime, Anywhere',
      copy: 'Bluetooth for the remote Wedding, Wi-Fi for the bars. LiquorBot just works.',
      icon: '🔗',
    },
    {
      title: 'Events & Sharing',
      copy: 'Create events, invite friends, and share your favorite drink recipes effortlessly.',
      icon: '🎉',
    },
  ];

  return (
    <section id="features" className="lb-features">
      <div className="lb-container feature-grid">
        {cards.map(({ title, copy, icon }) => (
          <div key={title} className="card">
            <div className="icon">{icon}</div>
            <h3>{title}</h3>
            <p>{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

const HelpCTA: React.FC = () => (
  <section id="help" className="lb-help">
    <div className="lb-container">
      <h2>Need a Hand?</h2>
      <p>
        The&nbsp;<strong>LiquorBot Help Center</strong> walks you through setup,
        troubleshooting and pro-level tips.
      </p>
      <a href="/help" className="lb-btn secondary">
        View Help&nbsp;→
      </a>
    </div>
  </section>
);

const Footer: React.FC = () => (
  <footer id="contact" className="lb-footer">
    <div className="lb-container footer-grid">
      <div>
        <h4>LiquorBot</h4>
        <p className="small">
          © {new Date().getFullYear()} LiquorBot, Inc. All rights reserved.
        </p>
      </div>

      <div>
        <h4>Links</h4>
        <ul>
          <li><a href="#features">Features</a></li>
          <li><a href="#help">Help</a></li>
          <li><a href="mailto:support@liquorbot.io">Support</a></li>
        </ul>
      </div>

      <div>
        <h4>Follow</h4>
        <ul>
          <li><a href="https://tiktok.com/@liquorbot"   target="_blank" rel="noopener noreferrer">TikTok</a></li>
          <li><a href="https://instagram.com/liquorbot" target="_blank" rel="noopener noreferrer">Instagram</a></li>
          <li><a href="https://youtube.com/@liquorbot"  target="_blank" rel="noopener noreferrer">YouTube</a></li>
        </ul>
      </div>
    </div>
  </footer>
);

/* -------------------------------------------------------------------------- */
/*                                  APP ROOT                                  */
/* -------------------------------------------------------------------------- */

const App: React.FC = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        setUser(null);
      }
    };

    checkAuth();

    // Listen to authentication events using Hub
    const removeListener = Hub.listen('auth', ({ payload }: { payload: { event: string } }) => {
      switch (payload.event) {
        case 'signedIn':
          checkAuth();
          break;
        case 'signedOut':
          setUser(null);
          break;
      }
    });

    return () => removeListener(); // Cleanup listener
  }, []);

  /** Minimal header override for the modal */
  const authComponents = {
    Header: () => (
      <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
        <h2 style={{ margin: 0 }}>Sign in to LiquorBot</h2>
      </div>
    ),
  };

  return (
    <ThemeProvider theme={liquorTheme}>
      <SiteHeader 
        onShowAuth={() => setShowAuth(true)} 
        user={user}
        signOut={signOut}  // Use directly imported signOut
      />
      <main>
        <Hero />
        <Features />
        <HelpCTA />
      </main>

      <Footer />

      {showAuth && (
        <div className="auth-modal">
          <button
            className="close-btn"
            onClick={() => setShowAuth(false)}
            style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', fontSize: '1.5rem', color: '#fff', cursor: 'pointer' }}
          >
            &times;
          </button>
          <Authenticator
            components={authComponents}
            variation="modal"
            hideSignUp={false}
            socialProviders={['google', 'facebook', 'apple']}
            loginMechanisms={['username']}
          >
            {({ signOut }) => {
              setShowAuth(false); // close on successful sign-in
              return (
                <div style={{ padding: 32, textAlign: 'center' }}>
                  <h3>Welcome back!</h3>
                  <button className="lb-btn" onClick={signOut}>
                    Sign Out
                  </button>
                </div>
              );
            }}
          </Authenticator>
        </div>
      )}
    </ThemeProvider>
  );
};

export default App;
