import React from 'react';
import './styles/Drinks.css';

const drinks = [
  {
    name: 'Classic Margarita',
    description: 'Tequila, lime juice, triple sec, and a salted rim. A timeless favorite.',
    image: '/assets/drinks/margarita.png',
  },
  {
    name: 'Whiskey Sour',
    description: 'Whiskey, lemon juice, and simple syrup. Balanced and refreshing.',
    image: '/assets/drinks/whiskeysour.png',
  },
  {
    name: 'Cosmopolitan',
    description: 'Vodka, cranberry juice, triple sec, and lime. Fruity and stylish.',
    image: '/assets/drinks/cosmopolitan.png',
  },
  {
    name: 'Mojito',
    description: 'White rum, mint, lime, sugar, and soda. Cool and invigorating.',
    image: '/assets/drinks/mojito.png',
  },
];

const Drinks: React.FC = () => (
  <div className="drinks-page lb-container" style={{padding: '4rem 0', textAlign: 'center'}}>
    <h1>Discover Cocktails</h1>
    <p className="subtitle">Explore popular recipes for your LiquorBot</p>
    <div className="drinks-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', margin: '3rem 0'}}>
      {drinks.map(drink => (
        <div className="drink-card" key={drink.name} style={{background: 'var(--tertiary-bg, #232323)', borderRadius: 12, padding: '2rem', boxShadow: '0 4px 16px rgba(0,0,0,0.12)'}}>
          <img src={drink.image} alt={drink.name} style={{width: 80, height: 80, objectFit: 'contain', marginBottom: 16}} />
          <h3 style={{margin: '1rem 0 0.5rem'}}>{drink.name}</h3>
          <p style={{color: '#cecece', fontSize: '1rem'}}>{drink.description}</p>
        </div>
      ))}
    </div>
    <p style={{marginTop: '2rem', color: '#cecece'}}>Want to create your own? <a href="/help">See how to add custom drinks</a>.</p>
  </div>
);

export default Drinks;
