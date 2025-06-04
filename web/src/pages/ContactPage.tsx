// ContactPage.tsx
import React from 'react';
import './styles/ContactPage.css';
import { FaInstagram, FaXTwitter, FaFacebookF } from 'react-icons/fa6';

const ContactPage: React.FC = () => (
  <section className="lb-contact">
    <div className="lb-container">
      <h2>Contact Us</h2>
      <div className="contact-divider" />
      <p>
        Email: <a href="mailto:nhambleton03@gmail.com">nhambleton03@gmail.com</a>
      </p>
      <p>Follow us on social media for updates!</p>
      <div className="social-row">
        <a href="https://instagram.com/liquorbot" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Instagram">
          <FaInstagram />
        </a>
        <a href="https://x.com/liquorbot" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="X (Twitter)">
          <FaXTwitter />
        </a>
        <a href="https://facebook.com/liquorbot" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Facebook">
          <FaFacebookF />
        </a>
      </div>
    </div>
  </section>
);

export default ContactPage;
