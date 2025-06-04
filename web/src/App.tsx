// File: App.tsx
import React, { useState, useEffect } from 'react';
import {
  Authenticator,
  ThemeProvider,
  type Theme,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './App.css';
import { FiX } from 'react-icons/fi';
import { Hub } from '@aws-amplify/core';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import EventsPage from './EventsPage';
import PrivacyPolicy from './PrivacyPolicy';
import { HomePage, HelpPage, ContactPage, DownloadPage } from './pages';
import { Link, Routes, Route, useLocation } from 'react-router-dom';

/* -------------------------------------------------------------------------- */
/*                               THEME OVERRIDE                               */
/* -------------------------------------------------------------------------- */
const liquorTheme: Theme = {
  name: 'liquorTheme',
  tokens: {
    colors: {
      background: {
        primary: { value: '#0f0f0f' },
        secondary: { value: '#1a1a1a' },
        tertiary: { value: '#2a2a2a' }
      },
      font: {
        primary: { value: '#ffffff' },
        secondary: { value: '#cecece' },
        interactive: { value: '#ce975e' }
      },
      brand: {
        primary: {
          '10': { value: '#ce975e' },
          '20': { value: '#d6a777' },
          '80': { value: '#ce975e' },
          '90': { value: '#ce975e' },
          '100': { value: '#ce975e' },
        },
      },
      border: {
        primary: { value: '#3a3a3a' },
        secondary: { value: '#4a4a4a' }
      }
    },
    radii: {
      small: { value: '6px' },
      medium: { value: '8px' },
      large: { value: '12px' }
    },
    space: {
      small: { value: '0.75rem' },
      medium: { value: '1.25rem' },
      large: { value: '2rem' }
    },
    fontSizes: {
      small: { value: '0.875rem' },
      medium: { value: '1rem' },
      large: { value: '1.25rem' },
      xl: { value: '2rem' },
      xxl: { value: '3rem' }
    }
  },
};

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
          setShowAuth(false);
          break;
        case 'signedOut':
          setUser(null);
          break;
      }
    });

    // Listen for custom event to show sign-in modal
    const showSignin = () => setShowAuth(true);
    window.addEventListener('show-signin-modal', showSignin);

    return () => {
      removeListener(); // Cleanup listener
      window.removeEventListener('show-signin-modal', showSignin);
    };
  }, []);

  /** Minimal header override for the modal */
  const authComponents = {
    Header: () => (
      <div className="auth-header">
        <h2>Sign in to LiquorBot</h2>
      </div>
    ),
  };

  const SiteHeader: React.FC<{ 
    onShowAuth: () => void; 
    user: any; 
    signOut: () => void;
  }> = ({ onShowAuth, user, signOut }) => {
    const location = useLocation();
    return (
      <header className="lb-header">
        <div className="lb-container">
          <Link className="lb-logo" to="/">
            <span className="logo-icon">🍸</span>
            <span>LiquorBot</span>
          </Link>
          <nav>
            <Link to="/downloads" className={location.pathname === '/downloads' ? 'active' : ''}>Downloads</Link>
            <Link to="/events" className={location.pathname === '/events' ? 'active' : ''}>Events</Link>
            <Link to="/drinks" className={location.pathname === '/drinks' ? 'active' : ''}>Drinks</Link>
            <Link to="/help" className={location.pathname === '/help' ? 'active' : ''}>Help</Link>
            <Link to="/contact" className={location.pathname === '/contact' ? 'active' : ''}>Contact</Link>
          </nav>
          {user ? (
            <button className="lb-btn" onClick={signOut}>
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

  const Footer: React.FC = () => (
    <footer id="contact" className="lb-footer">
      <div className="lb-container footer-grid">
        <div className="footer-brand">
          <Link className="lb-logo" to="/">
            <span className="logo-icon">🍸</span>
            <span>LiquorBot</span>
          </Link>
          <p className="small">
            © {new Date().getFullYear()} LiquorBot, Inc. All rights reserved.
          </p>
        </div>
        <div className="footer-links">
          <h4>Links</h4>
          <ul>
            <li><Link to="/features">Features</Link></li>
            <li><Link to="/previews">App Previews</Link></li>
            <li><Link to="/help">Help</Link></li>
            <li><a href="mailto:support@liquorbot.io">Support</a></li>
            <li><Link to="/privacy">Privacy Policy</Link></li>
          </ul>
        </div>
        <div className="footer-social">
          <h4>Follow</h4>
          <ul>
            <li><a href="https://tiktok.com/@liquorbot" target="_blank" rel="noopener noreferrer">TikTok</a></li>
            <li><a href="https://instagram.com/liquorbot" target="_blank" rel="noopener noreferrer">Instagram</a></li>
            <li><a href="https://youtube.com/@liquorbot" target="_blank" rel="noopener noreferrer">YouTube</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );

  return (
    <ThemeProvider theme={liquorTheme}>
      <SiteHeader 
        onShowAuth={() => setShowAuth(true)} 
        user={user}
        signOut={signOut}
      />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/downloads" element={<DownloadPage />} />
        <Route path="/drinks" element={<div style={{padding:'4rem',textAlign:'center'}}><h1>Drinks</h1><p>Explore and discover cocktail recipes for your LiquorBot.</p></div>} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/contact" element={<ContactPage />} />
        {/* Add more routes as needed */}
      </Routes>
      <Footer />
      {showAuth && (
        <div className="auth-modal">
          <button
            className="close-btn"
            onClick={() => setShowAuth(false)}
          >
            <FiX size={24} />
          </button>
          <Authenticator
            components={authComponents}
            variation="modal"
            hideSignUp={false}
            loginMechanisms={['username']}
            formFields={{
              signIn: {
                username: {
                  placeholder: 'Username',
                },
                password: {
                  placeholder: 'Password',
                },
              },
            }}
          >
            {() => <></>}
          </Authenticator>
        </div>
      )}
    </ThemeProvider>
  );
};

export default App;

// Components for lazy-loaded sections
export const RotatingImage: React.FC = () => <div className="rotating-image" />;
export const Hero: React.FC = () => <section className="hero-inner">
  {/* TODO: Implement Hero section content */}
</section>;
export const Features: React.FC = () => <section className="features-section">
  {/* TODO: Implement Features section content */}
</section>;
export const AppPreviews: React.FC = () => <section className="previews-section">
  {/* TODO: Implement App Previews section content */}
</section>;
export const HelpCTA: React.FC = () => <section className="help-cta-section">
  {/* TODO: Implement Help CTA content */}
</section>;