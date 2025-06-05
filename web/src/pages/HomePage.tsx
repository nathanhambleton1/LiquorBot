// File: App.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Authenticator,
  ThemeProvider,
  type Theme,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './styles/HomePage.css';
import { Amplify } from 'aws-amplify';
import awsconfig from '../amplifyconfiguration.json';
import { FiX } from 'react-icons/fi';
import { FaTiktok, FaInstagram, FaYoutube } from 'react-icons/fa6';
import { Routes, Route } from 'react-router-dom';
import EventsPage from './EventsPage';
import PrivacyPolicy from './PrivacyPolicy';

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
          src="/assets/apppreview_blank.png" 
          alt="LiquorBot App Preview" 
          className="app-preview"
        />
        <div className="device-shadow"></div>
      </div>
      {/* Floating images for depth effect (customizable) */}
      <div
        className="floating-image"
        style={{ top: '1.5%', left: '5%', transform: 'translateZ(30px) scale(1)', zIndex: 2 }}
      >
        <img src="/assets/liquorbot_overlay.png" alt="Liquorbot Overlay" style={{ width: 250, height: 250 }} />
      </div>
      <div
        className="floating-image"
        style={{ top: '-3%', right: '-15%', transform: 'translateZ(30px) scale(1)', zIndex: 2 }}
      >
        <img src="/assets/devicesettings_overlay.png" alt="Device Settings Overlay" style={{ width: 300, height: 300 }} />
      </div>
      <div
        className="floating-image"
        style={{ bottom: '12%', left: '-5%', transform: 'translateZ(40px) scale(1)', zIndex: 2 }}
      >
        <img src="/assets/events_overlay.png" alt="Events Overlay" style={{ width: 250, height: 250 }} />
      </div>
      <div
        className="floating-image"
        style={{ bottom: '15.5%', right: '-4%', transform: 'translateZ(40px) scale(1)', zIndex: 2 }}
      >
        <img src="/assets/drinkmenu_overlay.png" alt="Drink Menu Overlay" style={{ width: 250, height: 250 }} />
      </div>
      <div
        className="floating-image"
        style={{ bottom: '5.5%', right: '-5%', transform: 'translateZ(40px) scale(1)', zIndex: 2 }}
      >
        <img src="/assets/newevent_overlay.png" alt="New Event Overlay" style={{ width: 250, height: 250 }} />
      </div>
      {/* Social Media Icons - top right outside edge */}
      <div
        className="floating-image"
        style={{ top: '-5%', right: '-10%', transform: 'translateZ(-50px) scale(1)', zIndex: 2 }}
      >
        <FaTiktok size={54} color="#fff" />
      </div>
      <div
        className="floating-image"
        style={{ top: '10%', right: '-10%', transform: 'translateZ(-50px) scale(1)', zIndex: 2 }}
      >
        <FaInstagram size={54} color="#fff" />
      </div>
      <div
        className="floating-image"
        style={{ top: '25%', right: '-10%', transform: 'translateZ(-50px) scale(1)', zIndex: 2 }}
      >
        <FaYoutube size={54} color="#fff" />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                             UTILITY COMPONENTS                             */
/* -------------------------------------------------------------------------- */

const Hero: React.FC = () => (
  <section className="lb-hero">
    <div className="lb-container hero-inner">
      <div className="hero-content">
        <h1>
          Your Personal&nbsp;<span className="accent">Robotic Bartender</span>
        </h1>
        {/* Show placeholder image only on screens < 900px */}
        <img 
          src="/assets/apppreview_still.png" 
          alt="App Preview Still"
          className="hero-img-responsive"
          style={{ margin: '1.5rem auto', width: '100%', maxWidth: 340 }}
        />
        <p>
          LiquorBot mixes perfect cocktails on demand, tracks your favorites and
          keeps the party flowing all from the convenience of our companion app.
        </p>

        <div className="cta-row">
          <a className="store-btn" href="https://apps.apple.com/us/app/liquorbot/id6746461095" target="_blank" rel="noopener noreferrer">
            <img src="/assets/appstore.png" alt="Download on the App Store" />
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
    <div className="lb-container" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="help-content" style={{ maxWidth: 580, width: '100%', textAlign: 'center', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center' }}>Need a Hand?</h2>
        <p style={{ textAlign: 'center' }}>
          The&nbsp;<strong>LiquorBot Help Center</strong> walks you through setup,
          troubleshooting and pro-level tips.
        </p>
        <a href="/help" className="lb-btn secondary" style={{ display: 'block', margin: '1.5rem auto 0', textAlign: 'center', width: 'fit-content', minWidth: 300 }}>
          View Help
        </a>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*                                  APP ROOT                                  */
/* -------------------------------------------------------------------------- */

const App: React.FC = () => {
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    // Remove checkAuth and Hub listener logic since user state is not used
    // Only keep showSignin event for modal
    const showSignin = () => setShowAuth(true);
    window.addEventListener('show-signin-modal', showSignin);
    return () => {
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

  return (
    <ThemeProvider theme={liquorTheme}>
      <Routes>
        <Route path="/" element={
          <main>
            <Hero />
            <Features />
            <AppPreviews />
            <HelpCTA />
          </main>
        } />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/features" element={<Features />} />
        <Route path="/previews" element={<AppPreviews />} />
        <Route path="/help" element={<HelpCTA />} />
        {/* Add more routes as needed */}
      </Routes>
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