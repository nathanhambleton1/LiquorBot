import React, { useState, useEffect } from 'react';
import './styles/Drinks.css';
import { getUrl } from 'aws-amplify/storage';
import { FiSearch, FiChevronDown } from 'react-icons/fi';
import { Hub } from '@aws-amplify/core';
import { getCurrentUser } from 'aws-amplify/auth';

// Types
type Drink = {
  id: string;
  name: string;
  description?: string;
  image: string;
  ingredients?: string;
};

// Helper to parse ingredients
const parseIngredients = (ingredientString: string) => {
  if (!ingredientString) return [];
  return ingredientString.split(',').map(chunk => {
    const [id, amount, priority] = chunk.split(':');
    return { id: parseInt(id), amount: parseFloat(amount), priority: parseInt(priority) };
  });
};

const Drinks: React.FC = () => {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDrinkId, setExpandedDrinkId] = useState<string | null>(null);
  const [ingredientsList, setIngredientsList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication state
  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then(() => { if (mounted) setIsAuthenticated(true); })
      .catch(() => { if (mounted) setIsAuthenticated(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const fetchStandardDrinks = async () => {
      try {
        const url = await getUrl({ key: 'drinkMenu/drinks.json' });
        const response = await fetch(url.url);
        const data = await response.json();
        const ingUrl = await getUrl({ key: 'drinkMenu/ingredients.json' });
        const ingResponse = await fetch(ingUrl.url);
        const ingredientsData = await ingResponse.json();
        setIngredientsList(ingredientsData);
        const formattedDrinks = data.map((d: any) => ({
          id: `std-${d.id}`,
          name: d.name,
          description: d.description,
          image: d.image,
          ingredients: d.ingredients
        }));
        setDrinks(formattedDrinks);
      } catch (error) {
        console.error('Error fetching standard drinks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStandardDrinks();
  }, []);

  // Reload page on sign in/sign out
  useEffect(() => {
    const listener = (data: any) => {
      if (data?.payload?.event === 'signIn' || data?.payload?.event === 'signOut') {
        window.location.reload();
      }
    };
    const remove = Hub.listen('auth', listener);
    return () => {
      remove();
    };
  }, []);

  // Get ingredient name by ID
  const getIngredientName = (id: number) => {
    const ingredient = ingredientsList.find((i: any) => i.id === id);
    return ingredient ? ingredient.name : `Ingredient #${id}`;
  };

  // Filtered drinks
  const filteredDrinks = drinks.filter(drink => {
    const matchesSearch = drink.name.toLowerCase().includes(search.toLowerCase()) ||
      (drink.description && drink.description.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  // Toggle drink expansion
  const toggleExpand = (id: string) => {
    if (expandedDrinkId === id) {
      setExpandedDrinkId(null);
    } else {
      setExpandedDrinkId(id);
    }
  };

  if (isAuthenticated === false) {
    return (
      <div className="drinks-page lb-container" style={{textAlign: 'center', marginTop: '4rem'}}>
        <h1>Discover Cocktails</h1>
        <p className="subtitle">Explore popular recipes for your LiquorBot</p>
        <div style={{marginTop: '5rem', fontSize: '1rem'}}>
          Please{' '}
          <span
            style={{ color: '#ce975e', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
            onClick={() => window.dispatchEvent(new Event('show-signin-modal'))}
          >
            sign in
          </span>{' '}
          to view the drink menu.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="drinks-page lb-container">
        <div className="loader">Loading...</div>
      </div>
    );
  }

  return (
    <div className="drinks-page lb-container">
      <header className="drinks-header">
        <h1>Discover Cocktails</h1>
        <p className="subtitle">Explore popular recipes for your LiquorBot</p>
        <div className="search-bar-row" style={{margin: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
          <div className="search-bar-container" style={{position: 'relative', width: 480, maxWidth: '100%'}}>
            <input
              type="text"
              className="drinks-search-bar"
              placeholder="Search drinks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{padding: '0.75rem 2.5rem 0.75rem 1.25rem', borderRadius: 8, border: '1px solid #444', fontSize: '1rem', width: '100%'}}
            />
            <FiSearch style={{position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none'}} size={22} />
          </div>
        </div>
      </header>

      <div className="drinks-grid">
        {filteredDrinks.map(drink => (
          <div 
            className={`drink-card${expandedDrinkId === drink.id ? ' expanded' : ''}`}
            key={drink.id}
            style={{ position: 'relative' }}
          >
            <div 
              className="drink-card-header"
              onClick={() => toggleExpand(drink.id)}
            >
              <div className="drink-image-container">
                <img src={drink.image} alt={drink.name} className="drink-image" />
              </div>
              <div className="drink-info">
                <h3>{drink.name}</h3>
                {drink.description && (
                  <p className="description-preview">{drink.description.substring(0, 60)}{drink.description.length > 60 ? '...' : ''}</p>
                )}
              </div>
              <div className="expand-icon" style={{transition: 'transform 0.25s'}}>
                <FiChevronDown style={{
                  transform: expandedDrinkId === drink.id ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.25s',
                  color: '#cecece',
                  fontSize: 22
                }} />
              </div>
            </div>
            {expandedDrinkId === drink.id && (
              <div className="drink-details">
                <p>{drink.description}</p>
                {drink.ingredients && (
                  <div className="ingredients-section">
                    <h4>Ingredients</h4>
                    <ul>
                      {parseIngredients(drink.ingredients).map((ing, index) => (
                        <li key={index}>
                          {getIngredientName(ing.id)} - {ing.amount} oz (Priority: {ing.priority})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Drinks;