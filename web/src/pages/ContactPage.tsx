// ContactPage.tsx
import React from 'react';

const ContactPage: React.FC = () => (
  <section className="lb-contact" style={{ padding: '4rem 0', textAlign: 'center' }}>
    <div className="lb-container">
      <h2>Contact Us</h2>
      <p>Email: <a href="mailto:support@liquorbot.io">support@liquorbot.io</a></p>
      <p>Follow us on social media for updates!</p>
    </div>
  </section>
);

export default ContactPage;
