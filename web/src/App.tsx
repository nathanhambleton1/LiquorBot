// File: App.tsx
import React, { useState, useEffect } from 'react';
import {
  Authenticator,
  ThemeProvider,
  type Theme,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './App.css';
import { FiX, FiUser, FiLogOut, FiSettings, FiEdit } from 'react-icons/fi';
import { Hub } from '@aws-amplify/core';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import EventsPage from './pages/EventsPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { HomePage, HelpPage, ContactPage, DownloadPage, Drinks } from './pages';
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
  const [showEditProfile, setShowEditProfile] = useState(false); // NEW: edit profile panel state

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
          window.location.reload(); // Reload after sign in
          break;
        case 'signedOut':
          setUser(null);
          window.location.reload(); // Reload after sign out
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
    onShowEditProfile: () => void; // NEW: prop for edit profile
  }> = ({ onShowAuth, user, signOut, onShowEditProfile }) => {
    const location = useLocation();
    const [showDropdown, setShowDropdown] = React.useState(false);
    const avatarRef = React.useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    React.useEffect(() => {
      const handleClick = (e: MouseEvent) => {
        if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      };
      if (showDropdown) {
        document.addEventListener('mousedown', handleClick);
      } else {
        document.removeEventListener('mousedown', handleClick);
      }
      return () => document.removeEventListener('mousedown', handleClick);
    }, [showDropdown]);    // Get user initial or fallback icon
    const getAvatar = () => {
      // Always show a person icon as placeholder/profile image
      return <FiUser className="profile-icon" style={{ 
        color: '#ffffff', 
        fontSize: '18px',
        strokeWidth: 2
      }} />;
    };

    return (
      <header className="lb-header">
        <div className="lb-container">
          <Link className="lb-logo" to="/">
            <img src="/assets/logo.png" alt="LiquorBot Logo" className="logo-icon" style={{height:'1.8em',width:'auto'}} />
            <span>LiquorBot</span>
          </Link>
          <nav>
            <Link to="/downloads" className={location.pathname === '/downloads' ? 'active' : ''}>Download</Link>
            <Link to="/events" className={location.pathname === '/events' ? 'active' : ''}>Events</Link>
            <Link to="/drinks" className={location.pathname === '/drinks' ? 'active' : ''}>Drinks</Link>
            <Link to="/help" className={location.pathname === '/help' ? 'active' : ''}>Help</Link>
            <Link to="/contact" className={location.pathname === '/contact' ? 'active' : ''}>Contact</Link>
          </nav>
          <div ref={avatarRef} style={{ position: 'relative', marginLeft: 16 }}>            <button
              className="profile-avatar-btn"
              onClick={() => setShowDropdown(v => !v)}
              aria-label="Profile menu"
              style={{
                background: 'none',
                border: '2px solid #ce975e',
                borderRadius: '50%',
                width: 40,
                height: 40,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                boxShadow: showDropdown ? '0 0 0 2px #ce975e' : 'none',
                transition: 'box-shadow 0.2s, border-color 0.2s',
                color: '#ffffff'
              }}
            >
              {getAvatar()}
            </button>
            {showDropdown && (
              <div className="profile-dropdown" style={{ position: 'absolute', right: 0, top: 48, background: '#232323', borderRadius: 10, boxShadow: '0 4px 16px #0008', minWidth: 180, zIndex: 100, padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {user ? (
                  <>
                    <button className="profile-dropdown-item" style={{ background: 'none', border: 'none', color: '#cecece', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                      onClick={() => { setShowDropdown(false); onShowEditProfile(); }} // Open edit profile
                    >
                      <FiEdit /> Edit Profile
                    </button>
                    <button className="profile-dropdown-item" style={{ background: 'none', border: 'none', color: '#cecece', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <FiSettings /> Settings
                    </button>
                    <button className="profile-dropdown-item" onClick={signOut} style={{ background: 'none', border: 'none', color: '#d9534f', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <FiLogOut /> Sign Out
                    </button>
                  </>
                ) : (
                  <button className="profile-dropdown-item" onClick={onShowAuth} style={{ background: 'none', border: 'none', color: '#ce975e', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <FiUser /> Sign In
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
    );
  };

  const Footer: React.FC = () => (
    <footer id="contact" className="lb-footer">
      <div className="lb-container footer-grid">
        <div className="footer-brand">
          <Link className="lb-logo" to="/">
            <img src="/assets/logo.png" alt="LiquorBot Logo" className="logo-icon" style={{height:'2em',width:'auto'}} />
            <span>LiquorBot</span>
          </Link>
          <p className="small">
            © {new Date().getFullYear()} LiquorBot, Inc. All rights reserved.
          </p>
        </div>
        <div className="footer-links">
          <h4>Links</h4>
          <ul>
            <li><Link to="/help">Help</Link></li>
            <li><a href="/contact">Contact</a></li>
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
        onShowEditProfile={() => setShowEditProfile(true)} // Pass handler
      />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/downloads" element={<DownloadPage />} />
        <Route path="/drinks" element={<Drinks onShowAuth={() => setShowAuth(true)} />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/contact" element={<ContactPage />} />
        {/* Add more routes as needed */}
      </Routes>
      <Footer />
      {/* Edit Profile Panel */}
      {showEditProfile && (
        <EditProfilePanel onClose={() => setShowEditProfile(false)} user={user} />
      )}
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

// Sliding Edit Profile Panel
const EditProfilePanel: React.FC<{ onClose: () => void; user: any }> = ({ onClose, user }) => (
  <div className="edit-profile-panel-overlay" onClick={onClose}>
    <div className="edit-profile-panel" onClick={e => e.stopPropagation()}>
      <button className="close-btn" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16 }}><FiX size={24} /></button>
      <h2>Edit Profile</h2>
      {/* Example fields, replace with real profile fields as needed */}
      <form style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 32 }}>
        <label>
          Username
          <input type="text" defaultValue={user?.username || ''} style={{ width: '100%' }} />
        </label>
        <label>
          Email
          <input type="email" defaultValue={user?.attributes?.email || ''} style={{ width: '100%' }} />
        </label>
        <button type="submit" style={{ marginTop: 16, background: '#ce975e', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', fontWeight: 600, fontSize: 16 }}>Save Changes</button>
      </form>
    </div>
    <style>{`
      .edit-profile-panel-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.45);
        z-index: 2000;
        display: flex;
        justify-content: flex-end;
        align-items: stretch;
        transition: background 0.2s;
      }
      .edit-profile-panel {
        background: #181818;
        color: #fff;
        width: 350px;
        max-width: 100vw;
        height: 100%;
        box-shadow: -4px 0 24px #000a;
        position: relative;
        padding: 32px 32px 32px 32px;
        transform: translateX(0);
        animation: slideInRight 0.3s cubic-bezier(.4,1.4,.6,1) 1;
        overflow-y: auto;
      }
      @keyframes slideInRight {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
    `}</style>
  </div>
);