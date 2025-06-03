// File: App.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Authenticator,
  ThemeProvider,
  type Theme,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './App.css';
import { Amplify } from 'aws-amplify';
import awsconfig from './amplifyconfiguration.json';
import { FiLogOut, FiX } from 'react-icons/fi';
import { Hub } from '@aws-amplify/core';
import { getCurrentUser, signOut } from 'aws-amplify/auth';

Amplify.configure(awsconfig);

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
/*                              3D ROTATING IMAGE                            */
/* -------------------------------------------------------------------------- */
const RotatingImage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRotation = useRef({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0, y: 0 });
  const animationFrame = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const maxRotation = 20; // degrees
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const animate = () => {
      currentRotation.current.x = lerp(currentRotation.current.x, targetRotation.current.x, 0.12);
      currentRotation.current.y = lerp(currentRotation.current.y, targetRotation.current.y, 0.12);
      container.style.transform = `perspective(1000px) rotateX(${currentRotation.current.x}deg) rotateY(${currentRotation.current.y}deg)`;
      animationFrame.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let rotateX = -((e.clientY - centerY) / rect.height) * maxRotation;
      let rotateY = -((centerX - e.clientX) / rect.width) * maxRotation;
      // Clamp for smooth max edges
      rotateX = Math.max(-maxRotation, Math.min(maxRotation, rotateX));
      rotateY = Math.max(-maxRotation, Math.min(maxRotation, rotateY));
      targetRotation.current = { x: rotateX, y: rotateY };
    };

    const handleMouseLeave = () => {
      targetRotation.current = { x: 0, y: 0 };
    };

    // Attach to window instead of container
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="rotating-image"
      style={{
        perspective: '1000px',
        transition: 'transform 0.1s cubic-bezier(0.22, 1, 0.36, 1)',
        transformStyle: 'preserve-3d'
      }}
    >
      <div className="device-frame">
        <img 
          src="/assets/apppreview.png" 
          alt="LiquorBot App Preview" 
          className="app-preview"
        />
        <div className="device-shadow"></div>
      </div>
      {/* Floating icons for depth effect */}
      <div className="floating-icon icon-calendar">📅</div>
      <div className="floating-icon icon-people">👥</div>
      <div className="floating-icon icon-drink">🍹</div>
      <div className="floating-icon icon-share">🔄</div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                             UTILITY COMPONENTS                             */
/* -------------------------------------------------------------------------- */

const SiteHeader: React.FC<{ 
  onShowAuth: () => void; 
  user: any; 
  signOut: () => void;
}> = ({ onShowAuth, user, signOut }) => {

  return (
    <header className="lb-header">
      <div className="lb-container">
        {/* Logo + word-mark */}
        <div className="lb-logo" onClick={() => window.scrollTo(0, 0)}>
          <span className="logo-icon">🍸</span>
          <span>LiquorBot</span>
        </div>

        {/* Simple anchor-based nav */}
        <nav>
          <a href="#features">Features</a>
          <a href="#previews">App Previews</a>
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
      <div className="hero-content">
        <h1>
          Your Personal&nbsp;<span className="accent">Robotic Bartender</span>
        </h1>
        <p>
          LiquorBot mixes perfect cocktails on demand, tracks your favorites and
          keeps the party flowing — all from the convenience of our companion app.
        </p>

        <div className="cta-row">
          <a className="store-btn" href="#">
            <img src="/assets/appstore.png" alt="Download on the App Store" />
          </a>
          <a className="store-btn" href="#">
            <img src="/assets/googleplay.png" alt="Get it on Google Play" />
          </a>
        </div>
      </div>
      
      <div className="hero-image">
        <RotatingImage />
      </div>
    </div>
  </section>
);

const Features: React.FC = () => {
  const [selectedFeature, setSelectedFeature] = useState<null | {
    title: string;
    copy: string;
    icon: string;
  }>(null);

  const cards = [
    {
      title: 'Smart Pouring',
      copy: 'Precision pumps and sensors craft bar-quality drinks in seconds. LiquorBot uses advanced flow control and real-time feedback to ensure every pour is perfect, every time.',
      icon: '⚙️',
    },
    {
      title: 'Custom Recipes',
      copy: 'Design and save your own mixes — complete with a generated drink image. Personalize your cocktail experience and share your creations with friends.',
      icon: '✨',
    },
    {
      title: 'Anytime, Anywhere',
      copy: 'Bluetooth for the remote Wedding, Wi-Fi for the bars. LiquorBot just works. Seamless connectivity means you can control your bar from anywhere.',
      icon: '🔗',
    },
    {
      title: 'Events & Sharing',
      copy: 'Create events, invite friends, and share your favorite drink recipes effortlessly. LiquorBot makes every gathering memorable and interactive.',
      icon: '🎉',
    },
  ];

  return (
    <section id="features" className="lb-features">
      <div className="lb-container">
        <div className="section-header">
          <h2>Powerful Features</h2>
          <p className="subtitle">Everything you need for the perfect cocktail experience</p>
        </div>
        <div className="feature-grid">
          {cards.map((card) => (
            <div
              key={card.title}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedFeature(card)}
            >
              <div className="icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.copy.split('.')[0] + '.'}</p>
            </div>
          ))}
        </div>
      </div>
      {selectedFeature && (
        <div className="feature-modal-overlay" onClick={() => setSelectedFeature(null)}>
          <div className="feature-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedFeature(null)}><FiX size={24} /></button>
            <div className="feature-modal-icon">{selectedFeature.icon}</div>
            <h2>{selectedFeature.title}</h2>
            <p>{selectedFeature.copy}</p>
          </div>
        </div>
      )}
    </section>
  );
};

const AppPreviews: React.FC = () => {
  const previews = [
    { id: 1, title: 'Pour Drinks', img: '/assets/pourdrinks.png' },
    { id: 2, title: 'Plan Events', img: '/assets/planevents.png' },
    { id: 3, title: 'Custom Drinks', img: '/assets/customdrinks.png' },
    { id: 4, title: 'Explore Recipes', img: '/assets/explorerecipes.png' },
  ];

  return (
    <section id="previews" className="lb-previews">
      <div className="lb-container">
        <div className="section-header">
          <h2>App Previews</h2>
          <p className="subtitle">Explore the LiquorBot experience</p>
        </div>
        
        <div className="preview-grid">
          {previews.map(({ id, title, img }) => (
            <div key={id} className="preview-card">
              <div className="preview-header">
                <div className="dots">
                  <span className="dot red"></span>
                  <span className="dot yellow"></span>
                  <span className="dot green"></span>
                </div>
                <div className="preview-title">{title}</div>
              </div>
              <img 
                src={img} 
                alt={`App preview: ${title}`} 
                className="preview-image"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HelpCTA: React.FC = () => (
  <section id="help" className="lb-help">
    <div className="lb-container">
      <div className="help-content">
        <h2>Need a Hand?</h2>
        <p>
          The&nbsp;<strong>LiquorBot Help Center</strong> walks you through setup,
          troubleshooting and pro-level tips.
        </p>
        <a href="/help" className="lb-btn secondary">
          View Help&nbsp;→
        </a>
      </div>
    </div>
  </section>
);

const Footer: React.FC = () => (
  <footer id="contact" className="lb-footer">
    <div className="lb-container footer-grid">
      <div className="footer-brand">
        <div className="lb-logo">
          <span className="logo-icon">🍸</span>
          <span>LiquorBot</span>
        </div>
        <p className="small">
          © {new Date().getFullYear()} LiquorBot, Inc. All rights reserved.
        </p>
      </div>

      <div className="footer-links">
        <h4>Links</h4>
        <ul>
          <li><a href="#features">Features</a></li>
          <li><a href="#previews">App Previews</a></li>
          <li><a href="#help">Help</a></li>
          <li><a href="mailto:support@liquorbot.io">Support</a></li>
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

    return () => removeListener(); // Cleanup listener
  }, []);

  /** Minimal header override for the modal */
  const authComponents = {
    Header: () => (
      <div className="auth-header">
        <h2>Sign in to LiquorBot</h2>
      </div>
    ),
  };

  return (
    <ThemeProvider theme={liquorTheme}>
      <SiteHeader 
        onShowAuth={() => setShowAuth(true)} 
        user={user}
        signOut={signOut}
      />
      <main>
        <Hero />
        <Features />
        <AppPreviews />
        <HelpCTA />
      </main>

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