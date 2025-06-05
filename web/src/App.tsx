// File: App.tsx
import React, { useState, useEffect } from 'react';
import {
  Authenticator,
  ThemeProvider,
  type Theme,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './App.css';
import { 
  FiX, 
  FiUser, 
  FiLogOut, 
  FiSettings, 
  FiEdit,
  FiAlertTriangle,
  FiAlertCircle,
  FiChevronDown 
} from 'react-icons/fi';
import { Hub } from '@aws-amplify/core';
import { getCurrentUser, signOut, fetchUserAttributes } from 'aws-amplify/auth';
import EventsPage from './pages/EventsPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { HomePage, HelpPage, ContactPage, DownloadPage, Drinks } from './pages';
import { Link, Routes, Route, useLocation } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { getUserProfile } from './graphql/queries';
import { createUserProfile, updateUserProfile } from './graphql/mutations';

// Add after Amplify configuration
const client = generateClient();

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

// Language context for app-wide language switching
const LanguageContext = React.createContext({
  language: 'en',
  setLanguage: (_: string) => {},
});

const App: React.FC = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [language, setLanguage] = React.useState('en');
  const [authInitialState, setAuthInitialState] = React.useState<'signIn' | 'signUp'>('signIn');
  const [userProfile, setUserProfile] = useState<any>(null);

  const refreshUserAttributes = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser({ ...currentUser, attributes });
      
      // NEW: Fetch user profile from GraphQL API
      try {
        const profileRes = await client.graphql({
          query: getUserProfile,
          variables: { id: currentUser.username }
        });
        
        let profile = profileRes.data?.getUserProfile;
        if (!profile) {
          // Create profile if it doesn't exist
          const createRes = await client.graphql({
            query: createUserProfile,
            variables: {
              input: {
                id: currentUser.username,
                username: `${attributes.given_name || ''} ${attributes.family_name || ''}`.trim() || currentUser.username,
                bio: attributes.bio || '',
                profilePicture: '',
                role: 'USER'
              }
            }
          });
          profile = createRes.data?.createUserProfile;
        }
        setUserProfile(profile);
      } catch (err) {
        console.error('Error fetching user profile', err);
      }
    } catch (error) {
      console.error('Error refreshing user attributes', error);
    }
  };

  // Only allow one panel at a time
  const handleShowEditProfile = async () => {
    await refreshUserAttributes();
    setShowSettingsPanel(false);
    setShowEditProfile(true);
  };
  const handleShowSettingsPanel = () => {
    setShowEditProfile(false);
    setShowSettingsPanel(true);
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        setUser({ ...currentUser, attributes });
      } catch {
        setUser(null);
      }
    };

    checkAuth();

    // UPDATE: Handle auth events with async function
    const removeListener = Hub.listen('auth', async ({ payload }: { payload: { event: string } }) => {
      switch (payload.event) {
        case 'signedIn':
          await checkAuth();
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
    onShowEditProfile: () => void;
    onShowSettings: () => void;
  }> = ({ onShowAuth, user, signOut, onShowEditProfile, onShowSettings }) => {
    const location = useLocation();
    const [showDropdown, setShowDropdown] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 770);
    const avatarRef = React.useRef<HTMLDivElement>(null);

    // Responsive: update isMobile on resize
    React.useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 770);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

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
    }, [showDropdown]);

    // Hamburger icon
    const HamburgerIcon = () => (
      <div style={{ width: 28, height: 28, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
        <div style={{ width: 22, height: 3, background: '#ce975e', borderRadius: 2, margin: '2px 0' }} />
        <div style={{ width: 22, height: 3, background: '#ce975e', borderRadius: 2, margin: '2px 0' }} />
        <div style={{ width: 22, height: 3, background: '#ce975e', borderRadius: 2, margin: '2px 0' }} />
      </div>
    );

    // Get user initial or fallback icon
    const getAvatar = () => {
      return <FiUser className="profile-icon" style={{ 
        color: '#ffffff', 
        fontSize: '18px',
        strokeWidth: 2
      }} />;
    };

    // Dropdown menu content (for mobile and desktop)
    const dropdownMenu = (
      <div className="profile-dropdown" style={{ position: 'absolute', right: 0, top: 48, background: '#232323', borderRadius: 10, boxShadow: '0 4px 16px #0008', minWidth: 200, zIndex: 100, padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* User info segment (only if signed in) */}
        {user && user.attributes && (
          <div style={{ padding: '8px 18px 4px 18px', borderBottom: '1px solid #333', marginBottom: 4 }}>
            <div style={{ color: '#aaa', fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{user.username}</div>
            <div style={{ color: '#666', fontSize: 12 }}>{user.attributes.email}</div>
          </div>
        )}
        {/* Navigation links (only on mobile) */}
        {isMobile && (
          <>
            <Link to="/downloads" className="profile-dropdown-item" style={{ background: 'none', border: 'none', color: '#cecece', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textDecoration: 'none' }} onClick={() => setShowDropdown(false)}>Download</Link>
            <Link to="/events" className="profile-dropdown-item" style={{ background: 'none', border: 'none', color: '#cecece', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textDecoration: 'none' }} onClick={() => setShowDropdown(false)}>Events</Link>
            <Link to="/drinks" className="profile-dropdown-item" style={{ background: 'none', border: 'none', color: '#cecece', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textDecoration: 'none' }} onClick={() => setShowDropdown(false)}>Drinks</Link>
            <Link to="/help" className="profile-dropdown-item" style={{ background: 'none', border: 'none', color: '#cecece', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textDecoration: 'none' }} onClick={() => setShowDropdown(false)}>Help</Link>
            <Link to="/contact" className="profile-dropdown-item" style={{ background: 'none', border: 'none', color: '#cecece', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textDecoration: 'none' }} onClick={() => setShowDropdown(false)}>Contact</Link>
            <div style={{ borderTop: '1px solid #333', margin: '8px 0' }} />
          </>
        )}
        {/* Profile actions */}
        {user ? (
          <>
            <button className="profile-dropdown-item" style={{ background: 'none', border: 'none', color: '#cecece', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
              onClick={() => { setShowDropdown(false); onShowEditProfile(); }} 
            >
              <FiEdit /> Edit Profile
            </button>
            <button className="profile-dropdown-item" style={{ background: 'none', border: 'none', color: '#cecece', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
              onClick={() => { setShowDropdown(false); onShowSettings(); }}
            >
              <FiSettings /> Settings
            </button>
            <button className="profile-dropdown-item" onClick={signOut} style={{ background: 'none', border: 'none', color: '#d9534f', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <FiLogOut /> Sign Out
            </button>
          </>
        ) : (
          <>
            <button className="profile-dropdown-item" onClick={() => { setAuthInitialState('signIn'); onShowAuth(); }} style={{ background: 'none', border: 'none', color: '#ce975e', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <FiUser /> Sign In
            </button>
            <button className="profile-dropdown-item" onClick={() => { setAuthInitialState('signUp'); setShowDropdown(false); setShowAuth(true); }} style={{ background: 'none', border: 'none', color: '#cecece', textAlign: 'left', padding: '10px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <FiUser style={{ opacity: 0.7 }} /> Sign Up
            </button>
          </>
        )}
      </div>
    );

    return (
      <header className="lb-header">
        <div className="lb-container">
          <Link className="lb-logo" to="/">
            <img src="/assets/logo.png" alt="LiquorBot Logo" className="logo-icon" style={{height:'1.8em',width:'auto'}} />
            <span>LiquorBot</span>
          </Link>
          {/* Desktop nav */}
          {!isMobile && (
            <nav>
              <Link to="/downloads" className={location.pathname === '/downloads' ? 'active' : ''}>Download</Link>
              <Link to="/events" className={location.pathname === '/events' ? 'active' : ''}>Events</Link>
              <Link to="/drinks" className={location.pathname === '/drinks' ? 'active' : ''}>Drinks</Link>
              <Link to="/help" className={location.pathname === '/help' ? 'active' : ''}>Help</Link>
              <Link to="/contact" className={location.pathname === '/contact' ? 'active' : ''}>Contact</Link>
            </nav>
          )}
          {/* Avatar or Hamburger */}
          <div ref={avatarRef} style={{ position: 'relative', marginLeft: 16 }}>
            <button
              className="profile-avatar-btn"
              onClick={() => setShowDropdown(v => !v)}
              aria-label={isMobile ? 'Open menu' : 'Profile menu'}
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
              {isMobile ? <HamburgerIcon /> : getAvatar()}
            </button>
            {showDropdown && dropdownMenu}
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

  // Cookie/localStorage consent banner state
  const [showCookieBanner, setShowCookieBanner] = React.useState(() => {
    // Only show if not previously accepted
    return !localStorage.getItem('liquorbot_cookie_consent');
  });

  const handleAcceptCookies = () => {
    localStorage.setItem('liquorbot_cookie_consent', 'true');
    setShowCookieBanner(false);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <ThemeProvider theme={liquorTheme}>
        <SiteHeader 
          onShowAuth={() => setShowAuth(true)} 
          user={user}
          signOut={signOut}
          onShowEditProfile={handleShowEditProfile}
          onShowSettings={handleShowSettingsPanel}
        />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/downloads" element={<DownloadPage />} />
          <Route path="/drinks" element={<Drinks />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/contact" element={<ContactPage />} />
          {/* Add more routes as needed */}
        </Routes>
        <Footer />
        {/* Edit Profile Panel */}
        {showEditProfile && (
          <EditProfilePanel 
            onClose={() => setShowEditProfile(false)} 
            user={user} 
            userProfile={userProfile}
            refreshProfile={refreshUserAttributes} // Add refresh function
          />
        )}
        {showSettingsPanel && (
          <SettingsPanel onClose={() => setShowSettingsPanel(false)} />
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
              initialState={authInitialState}
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
              className="custom-auth-amplify"
            >
              {() => <></>}
            </Authenticator>
          </div>
        )}
        {/* Cookie/localStorage consent banner */}
        {showCookieBanner && (
          <div style={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            zIndex: 3000,
            display: 'flex',
            justifyContent: 'flex-start',
            pointerEvents: 'none',
            width: '100%',
          }}>
            <div
              style={{
                background: '#232323',
                color: '#DFDCD9',
                borderRadius: 14,
                boxShadow: '0 4px 24px #0008',
                padding: '14px 32px',
                display: 'flex',
                alignItems: 'center',
                gap: 22,
                maxWidth: 650,
                width: '99vw',
                fontSize: 15,
                pointerEvents: 'auto',
                flexWrap: 'wrap',
              }}
            >
              {/* Cookie image */}
              <img src="/assets/cookie.png" alt="Cookie" style={{ width: 38, height: 38, objectFit: 'contain', marginRight: 10, background: 'none', borderRadius: 0, padding: 0 }} />
              <span style={{ flex: 1, minWidth: 120 }}>
                This site uses cookies. By continuing, you accept our use of cookies.
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleAcceptCookies}
                  style={{
                    background: '#CE975E',
                    color: '#232323',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 18px',
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Accept
                </button>
                <button
                  onClick={() => setShowCookieBanner(false)}
                  style={{
                    background: 'transparent',
                    color: '#aaa',
                    border: '1px solid #444',
                    borderRadius: 8,
                    padding: '8px 18px',
                    fontWeight: 500,
                    fontSize: 15,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}
      </ThemeProvider>
    </LanguageContext.Provider>
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

const EditProfilePanel: React.FC<{ 
  onClose: () => void; 
  user: any;
  userProfile: any;
  refreshProfile: () => void;
}> = ({ onClose, user, userProfile, refreshProfile }) => {
  // Extract user info from attributes
  const registeredUsername = user?.username || '';
  const email = user?.attributes?.email || '';
  const birthdayAttr = user?.attributes?.birthdate || '';

  // State for editable fields
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false); // Add loading state

  // Update form fields when user profile changes
  React.useEffect(() => {
    if (userProfile) {
      // Split full name from userProfile
      const fullName = userProfile.username || '';
      const nameParts = fullName.split(' ');
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');
      setBio(userProfile.bio || '');
    }
  }, [userProfile]);

  // Save handler with API integration
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      await client.graphql({
        query: updateUserProfile,
        variables: {
          input: {
            id: userProfile.id,
            username: fullName,
            bio
          }
        }
      });
      
      // Refresh profile data after saving
      await refreshProfile();
      onClose();
    } catch (error) {
      console.error('Error updating profile', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="edit-profile-panel-overlay" onClick={onClose}>
      <div className="edit-profile-panel" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16 }}><FiX size={24} /></button>
        <h2>Edit Profile</h2>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 25 }}>
          <div style={{ marginLeft: 0 }}>
            <div style={{ color: '#DFDCD9', fontSize: 20, fontWeight: 'bold' }}>{registeredUsername}</div>
            <div style={{ color: '#4F4F4F', fontSize: 14, marginTop: 5 }}>{email}</div>
          </div>
        </div>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-container">
            <label className="label">First Name</label>
            <input className="input" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div className="input-container">
            <label className="label">Last Name</label>
            <input className="input" type="text" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
          <div className="input-container">
            <label className="label">Birthday</label>
            <div className="readonly">{birthdayAttr ? birthdayAttr.replace(/-/g, '/') : 'Not provided'}</div>
            <div className="support">If this is incorrect, please contact support.</div>
          </div>
          <div className="input-container bio-container" style={{ position: 'relative' }}>
            <label className="label">Bio</label>
            <textarea
              className="input bio-input"
              value={bio}
              onChange={e => {
                const txt = e.target.value;
                if (txt.length <= 100 && txt.split('\n').length <= 3) setBio(txt);
              }}
              maxLength={100}
              rows={3}
              style={{ resize: 'none', height: 78 }}
              placeholder="Tell us about yourself (max 100 chars, 3 lines)"
            />
            <div className="counter" style={{ position: 'absolute', right: 10, bottom: -18, color: '#4F4F4F', fontSize: 12 }}>{bio.length}/100</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', marginTop: 30 }}>
            <button
              type="submit"
              className="save-btn"
              style={{ background: '#CE975E', padding: '12px 25px', borderRadius: 10, marginRight: 10, color: '#DFDCD9', fontSize: 16, fontWeight: 600, border: 'none', opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="cancel-btn" style={{ background: '#444', padding: '12px 25px', borderRadius: 10, color: '#DFDCD9', fontSize: 16, fontWeight: 600, border: 'none' }} onClick={onClose} disabled={isSaving}>Cancel</button>
          </div>
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
        .input-container { width: 100%; margin-bottom: 18px; }
        .label { color: #DFDCD9; font-size: 16px; margin-bottom: 5px; display: block; }
        .input { background: #1F1F1F; border-radius: 10px; padding: 12px 15px; color: #DFDCD9; font-size: 16px; border: none; width: 100%; }
        .readonly { background: #1F1F1F; border-radius: 10px; padding: 12px 15px; color: #4F4F4F; font-size: 16px; }
        .support { color: #4F4F4F; font-size: 12px; margin-top: 5px; }
        .bio-input { height: 78px; }
        .counter { position: absolute; right: 10px; bottom: -18px; color: #4F4F4F; font-size: 12px; }
        .save-btn { background: #CE975E; padding: 12px 25px; border-radius: 10px; margin-right: 10px; color: #DFDCD9; font-size: 16px; font-weight: 600; border: none; }
        .cancel-btn { background: #444; padding: 12px 25px; border-radius: 10px; color: #DFDCD9; fontSize: 16px; fontWeight: 600; border: none; }
      `}</style>
    </div>
  );
};

const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { language, setLanguage } = React.useContext(LanguageContext);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [openSection, setOpenSection] = React.useState<string | null>(null);
  // Notification toggle state
  const [notificationsAllowed, setNotificationsAllowed] = React.useState(Notification.permission === 'granted');
  const [notificationError, setNotificationError] = React.useState<string | null>(null);

  const handleNotificationToggle = async () => {
    if (notificationsAllowed) {
      // No way to revoke permission from JS, so just update UI
      setNotificationsAllowed(false);
      setNotificationError('To fully disable, change your browser settings.');
    } else {
      try {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
          setNotificationsAllowed(true);
          setNotificationError(null);
        } else if (result === 'denied') {
          setNotificationsAllowed(false);
          setNotificationError('Permission denied. Enable in browser settings.');
        } else {
          setNotificationsAllowed(false);
          setNotificationError('Permission not granted.');
        }
      } catch (e) {
        setNotificationError('Error requesting permission.');
      }
    }
  };

  return (
    <div className="edit-profile-panel-overlay" onClick={onClose}>
      <div className="edit-profile-panel" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16 }}>
          <FiX size={24} />
        </button>
        <h2>Settings</h2>
        {/* Notifications */}
        <div className="settings-section">
          <button className="settings-section-btn" onClick={() => setOpenSection(openSection === 'notifications' ? null : 'notifications')} style={{...sectionBtnStyle, marginTop: 0}}>
            <span>Notifications</span>
            <FiChevronDown style={{ fontSize: 22, marginLeft: 8, transform: openSection === 'notifications' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {openSection === 'notifications' && (
            <div className="settings-section-content">
              <label style={{ color: '#cecece', fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  checked={notificationsAllowed}
                  onChange={handleNotificationToggle}
                  style={{ marginRight: 10, accentColor: '#ce975e', width: 18, height: 18 }}
                  disabled={Notification.permission === 'denied'}
                />
                Allow browser notifications
              </label>
              {notificationError && <div style={{ color: '#e74c3c', fontSize: 13, marginTop: 6 }}>{notificationError}</div>}
              <div style={{ color: '#aaa', fontSize: 13, marginTop: 8 }}>
                You can change notification permissions in your browser settings at any time.
              </div>
            </div>
          )}
        </div>
        {/* Language */}
        <div className="settings-section">
          <button className="settings-section-btn" onClick={() => setOpenSection(openSection === 'language' ? null : 'language')} style={sectionBtnStyle}>
            <span>Language</span>
            <FiChevronDown style={{ fontSize: 22, marginLeft: 8, transform: openSection === 'language' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {openSection === 'language' && (
            <div className="settings-section-content">
              <label style={{ color: '#cecece', fontSize: 14, marginBottom: 8, display: 'block' }}>Language</label>
              <select
                style={{ width: '100%', padding: '8px', borderRadius: 7, background: '#232323', color: '#DFDCD9', border: '1px solid #444', marginBottom: 10 }}
                value={language}
                onChange={e => setLanguage(e.target.value)}
              >
                <option value="en">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                {/* Add more languages as needed */}
              </select>
              <div style={{ color: '#aaa', fontSize: 13 }}>Region: United States (default)</div>
            </div>
          )}
        </div>
        {/* Support */}
        <div className="settings-section">
          <button className="settings-section-btn" onClick={() => setOpenSection(openSection === 'support' ? null : 'support')} style={sectionBtnStyle}>
            <span>Support</span>
            <FiChevronDown style={{ fontSize: 22, marginLeft: 8, transform: openSection === 'support' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {openSection === 'support' && (
            <div className="settings-section-content">
              <p style={{ color: '#cecece', fontSize: 14, marginBottom: 8 }}>Need help? Contact our support team:</p>
              <ul style={{ color: '#aaa', fontSize: 13, marginLeft: 18, marginBottom: 0 }}>
                <li>Email: <a href="mailto:nhambleton03@gmail.com" style={{ color: '#ce975e' }}>nhambleton03@gmail.com</a></li>
                <li><a href="/help" style={{ color: '#ce975e' }}>Help Center</a></li>
                <li><a href="/contact" style={{ color: '#ce975e' }}>Contact Form</a></li>
              </ul>
            </div>
          )}
        </div>
        {/* Sign Out Button */}
        <div style={{ marginBottom: 24, marginTop: 30 }}>
          <button 
            className="signout-btn"
            style={{ width: '100%', fontSize: 15, padding: '8px 0', borderRadius: 8, background: '#444', color: '#DFDCD9', border: 'none', fontWeight: 500, marginBottom: 8 }}
            onClick={() => { signOut(); onClose(); }}
          >
            <FiLogOut style={{ marginRight: 8, verticalAlign: 'middle' }} /> Sign Out
          </button>
        </div>
        {/* Danger Zone */}
        <div className="danger-zone" style={{ marginTop: 10 }}>
          <h3 style={{ color: '#e74c3c', fontSize: 17, marginBottom: 10, marginTop: 0, paddingTop: 0, display: 'flex', alignItems: 'center' }}>
            <FiAlertTriangle style={{ marginRight: 8, fontSize: 20, verticalAlign: 'middle' }} /> 
            Danger Zone
          </h3>
          <div className="danger-option">
            <button 
              className="delete-btn"
              style={{
                fontSize: 14,
                padding: '10px 0',
                borderRadius: 8,
                background: '#d44a4a',
                color: '#fff',
                border: 'none',
                width: '100%',
                fontWeight: 500,
                marginBottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 0.15s',
                paddingLeft: 18,
                paddingRight: 10,
              }}
              onClick={() => setShowDeleteConfirm(v => !v)}
            >
              <span style={{ textAlign: 'left', flex: 1 }}>Delete Account</span>
              <FiChevronDown style={{ fontSize: 24, marginLeft: 8, paddingRight: 6, transform: showDeleteConfirm ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {showDeleteConfirm && (
              <div className="delete-confirm" style={{ marginTop: 14, background: '#2a1818', borderRadius: 8, padding: '16px 10px 12px 10px', boxShadow: '0 2px 8px #0003' }}>
                <p className="warning-text" style={{ color: '#e74c3c', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <FiAlertCircle style={{ marginRight: 10, fontSize: 28, verticalAlign: 'middle' }} />
                  Warning: This action cannot be undone!
                </p>
                <p style={{ fontSize: 13, color: '#fff', marginBottom: 16, textAlign: 'center' }}>All your data will be permanently deleted.</p>
                <div className="delete-actions" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button 
                    className="cancel-btn"
                    style={{ fontSize: 13, padding: '7px 18px', borderRadius: 7, background: '#444', color: '#DFDCD9', border: 'none', fontWeight: 500 }}
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="confirm-delete-btn"
                    style={{ fontSize: 13, padding: '7px 18px', borderRadius: 7, background: '#d9534f', color: '#fff', border: 'none', fontWeight: 600 }}
                    onClick={() => {
                      // Implement actual delete functionality here
                      console.log("Account deletion initiated");
                    }}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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
        .settings-section { margin-bottom: 10px; }
        .settings-section-btn {
          width: 100%;
          background: #232323;
          color: #DFDCD9;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 500;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0;
          margin-top: 10px;
          transition: background 0.15s;
          cursor: pointer;
        }
        .settings-section-content {
          background: #202020;
          border-radius: 8px;
          padding: 14px 16px 10px 16px;
          margin-top: 2px;
          margin-bottom: 2px;
        }
        .custom-auth-amplify .amplify-button,
        .custom-auth-amplify .amplify-button--primary {
          background-color: #ce975e !important;
          color: #232323 !important;
          border: none !important;
          font-weight: 600;
          transition: background 0.15s;
        }
        .custom-auth-amplify .amplify-button:hover,
        .custom-auth-amplify .amplify-button--primary:hover {
          background-color: #b8864b !important;
        }
      `}</style>
    </div>
  );
};
const sectionBtnStyle = {
  width: '100%',
  background: '#232323',
  color: '#DFDCD9',
  border: 'none',
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 500,
  padding: '12px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 0,
  marginTop: 10,
  transition: 'background 0.15s',
  cursor: 'pointer',
};