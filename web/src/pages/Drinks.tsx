import React, { useState, useEffect, useCallback } from 'react';
import './styles/Drinks.css';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';
import { Amplify } from 'aws-amplify';
import config from '../amplifyconfiguration.json';
import { createCustomRecipe, updateCustomRecipe, deleteCustomRecipe } from '../graphql/mutations';
import { listCustomRecipes } from '../graphql/queries';
import { uploadData } from 'aws-amplify/storage';
import { FiSearch } from 'react-icons/fi';

// Configure Amplify
Amplify.configure(config);
const client = generateClient();

// Types
type Drink = {
  id: string;
  name: string;
  description?: string;
  image: string;
  isCustom?: boolean;
  ingredients?: string;
};

type CustomDrink = Drink & {
  recipeId: string;
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
  const [customDrinks, setCustomDrinks] = useState<CustomDrink[]>([]);
  const [standardDrinks, setStandardDrinks] = useState<Drink[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentDrink, setCurrentDrink] = useState<CustomDrink | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDrinkId, setExpandedDrinkId] = useState<string | null>(null);
  const [ingredientsList, setIngredientsList] = useState<any[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [ingredients, setIngredients] = useState<string>('');

  // Search state
  const [search, setSearch] = useState('');

  // Toggle for custom drinks only
  const [showCustomOnly, setShowCustomOnly] = useState(false);

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await getCurrentUser();
        setIsLoggedIn(true);
        fetchCustomDrinks();
      } catch {
        setIsLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Fetch standard drinks from server
  const fetchStandardDrinks = useCallback(async () => {
    try {
      const url = await getUrl({ key: 'drinkMenu/drinks.json' });
      const response = await fetch(url.url);
      const data = await response.json();
      
      // Fetch ingredient names
      const ingUrl = await getUrl({ key: 'drinkMenu/ingredients.json' });
      const ingResponse = await fetch(ingUrl.url);
      const ingredientsData = await ingResponse.json();
      setIngredientsList(ingredientsData);
      
      // Map to standard drinks format
      const formattedDrinks = data.map((d: any) => ({
        id: `std-${d.id}`,
        name: d.name,
        description: d.description,
        image: d.image,
        ingredients: d.ingredients
      }));
      
      setStandardDrinks(formattedDrinks);
    } catch (error) {
      console.error('Error fetching standard drinks:', error);
    }
  }, []);

  // Combine standard and custom drinks
  useEffect(() => {
    const allDrinks = [
      ...standardDrinks,
      ...customDrinks.map(d => ({ ...d, isCustom: true }))
    ];
    setDrinks(allDrinks);
  }, [standardDrinks, customDrinks]);

  // Fetch custom drinks
  const fetchCustomDrinks = async () => {
    try {
      const result = await client.graphql({ 
        query: listCustomRecipes,
        authMode: 'userPool'
      });
      
      const items = result.data?.listCustomRecipes?.items || [];
      
      const drinksWithImages = await Promise.all(
        items.map(async (item: any) => {
          let imageUrl = '/assets/drinks/placeholder.png';
          if (item.image) {
            try {
              const { url } = await getUrl({ key: item.image });
              imageUrl = url.toString();
            } catch (error) {
              console.error('Error loading image:', error);
            }
          }
          
          return {
            id: item.id,
            recipeId: item.id,
            name: item.name,
            description: item.description,
            image: imageUrl,
            isCustom: true,
            ingredients: item.ingredients
          };
        })
      );
      
      setCustomDrinks(drinksWithImages);
    } catch (error) {
      console.error('Error fetching custom drinks:', error);
    }
  };

  // Fetch all data on load
  useEffect(() => {
    fetchStandardDrinks();
  }, [fetchStandardDrinks]);

  // Handle create drink
  const handleCreate = async () => {
    if (!name) return;
    
    try {
      let imageKey = '';
      
      // Upload image if selected
      if (imageFile) {
        const key = `drink-images/${Date.now()}-${imageFile.name}`;
        await uploadData({
          key,
          data: imageFile,
          options: { contentType: imageFile.type }
        }).result;
        imageKey = key;
      }
      
      // Create the drink
      await client.graphql({
        query: createCustomRecipe,
        variables: {
          input: {
            name,
            description: description || null,
            image: imageKey || null,
            ingredients: ingredients
              ? ingredients.split(',').map(chunk => {
                  const [id, amount, priority] = chunk.split(':');
                  return {
                    ingredientId: parseInt(id),
                    amount: parseFloat(amount),
                    priority: parseInt(priority)
                  };
                })
              : []
          }
        },
        authMode: 'userPool'
      });
      
      // Refresh list
      fetchCustomDrinks();
      closeModal();
    } catch (error) {
      console.error('Error creating drink:', error);
    }
  };

  // Handle update drink
  const handleUpdate = async () => {
    if (!currentDrink || !name) return;
    
    try {
      let imageKey = currentDrink.image.includes('drink-images/') 
        ? currentDrink.image.split('/').pop() || ''
        : '';
      
      // Upload new image if selected
      if (imageFile) {
        const key = `drink-images/${Date.now()}-${imageFile.name}`;
        await uploadData({
          key,
          data: imageFile,
          options: { contentType: imageFile.type }
        }).result;
        imageKey = key;
      }
      
      // Update the drink
      await client.graphql({
        query: updateCustomRecipe,
        variables: {
          input: {
            id: currentDrink.recipeId,
            name,
            description: description || null,
            image: imageKey || null,
            ingredients: ingredients
              ? ingredients.split(',').map(chunk => {
                  const [id, amount, priority] = chunk.split(':');
                  return {
                    ingredientId: parseInt(id),
                    amount: parseFloat(amount),
                    priority: parseInt(priority)
                  };
                })
              : []
          }
        },
        authMode: 'userPool'
      });
      
      // Refresh list
      fetchCustomDrinks();
      closeModal();
    } catch (error) {
      console.error('Error updating drink:', error);
    }
  };

  // Handle delete drink
  const handleDelete = async (drink: CustomDrink) => {
    if (window.confirm(`Delete "${drink.name}" permanently?`)) {
      try {
        await client.graphql({
          query: deleteCustomRecipe,
          variables: { input: { id: drink.recipeId } },
          authMode: 'userPool'
        });
        fetchCustomDrinks();
      } catch (error) {
        console.error('Error deleting drink:', error);
      }
    }
  };

  // Open create modal
  const openCreateModal = () => {
    setName('');
    setDescription('');
    setIngredients('');
    setImageFile(null);
    setImagePreview('');
    setShowCreateModal(true);
  };

  // Open edit modal
  const openEditModal = (drink: CustomDrink) => {
    setCurrentDrink(drink);
    setName(drink.name);
    setDescription(drink.description || '');
    setIngredients(drink.ingredients || '');
    setImagePreview(drink.image);
    setImageFile(null);
    setShowEditModal(true);
  };

  // Close all modals
  const closeModal = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setCurrentDrink(null);
  };

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Toggle drink expansion
  const toggleExpand = (id: string) => {
    if (expandedDrinkId === id) {
      setExpandedDrinkId(null);
    } else {
      setExpandedDrinkId(id);
    }
  };

  // Get ingredient name by ID
  const getIngredientName = (id: number) => {
    const ingredient = ingredientsList.find((i: any) => i.id === id);
    return ingredient ? ingredient.name : `Ingredient #${id}`;
  };

  // Filtered drinks
  const filteredDrinks = drinks.filter(drink => {
    const matchesSearch = drink.name.toLowerCase().includes(search.toLowerCase()) ||
      (drink.description && drink.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCustom = !showCustomOnly || drink.isCustom;
    return matchesSearch && matchesCustom;
  });

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
          <div style={{display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: 8}}>
            {isLoggedIn && (
              <button className="create-drink-btn" onClick={openCreateModal} style={{whiteSpace: 'nowrap', padding: '0.75rem 1.25rem', fontSize: '1rem', borderRadius: 8}}>
                + Create Custom Drink
              </button>
            )}
            <div className="toggle-label" style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <span style={{fontSize: '1rem', color: '#cecece'}}>Custom Only</span>
              <button
                className={`ios-toggle${showCustomOnly ? ' checked' : ''}`}
                onClick={() => setShowCustomOnly(v => !v)}
                aria-pressed={showCustomOnly}
                tabIndex={0}
                type="button"
              >
                <span className="ios-toggle-track">
                  <span className="ios-toggle-thumb" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="drinks-grid">
        {filteredDrinks.map(drink => (
          <div 
            className={`drink-card ${drink.isCustom ? 'custom' : ''} ${expandedDrinkId === drink.id ? 'expanded' : ''}`}
            key={drink.id}
          >
            <div 
              className="drink-card-header"
              onClick={() => toggleExpand(drink.id)}
            >
              <div className="drink-image-container">
                <img src={drink.image} alt={drink.name} className="drink-image" />
                {drink.isCustom && (
                  <div className="custom-badge">Custom</div>
                )}
              </div>
              
              <div className="drink-info">
                <h3>{drink.name}</h3>
                <p className="description-preview">{drink.description?.substring(0, 60)}...</p>
              </div>
              
              <div className="expand-icon">
                {expandedDrinkId === drink.id ? '▲' : '▼'}
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
                
                {drink.isCustom && isLoggedIn && (
                  <div className="drink-actions">
                    <button 
                      className="edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(drink as CustomDrink);
                      }}
                    >
                      Edit
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(drink as CustomDrink);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Drink Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="drink-modal">
            <button className="close-modal" onClick={closeModal}>×</button>
            <h2>Create Custom Drink</h2>
            
            <div className="form-group">
              <label>Drink Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter drink name"
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
              />
            </div>
            
            <div className="form-group">
              <label>Ingredients</label>
              <textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="Enter ingredients in format: id:amount:priority,id:amount:priority"
              />
              <p className="hint">Format: ingredientId:amount:priority, separated by commas</p>
            </div>
            
            <div className="form-group">
              <label>Drink Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={closeModal}>Cancel</button>
              <button className="save-btn" onClick={handleCreate}>Create Drink</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Drink Modal */}
      {showEditModal && currentDrink && (
        <div className="modal-overlay">
          <div className="drink-modal">
            <button className="close-modal" onClick={closeModal}>×</button>
            <h2>Edit Drink</h2>
            
            <div className="form-group">
              <label>Drink Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter drink name"
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
              />
            </div>
            
            <div className="form-group">
              <label>Ingredients</label>
              <textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="Enter ingredients in format: id:amount:priority,id:amount:priority"
              />
              <p className="hint">Format: ingredientId:amount:priority, separated by commas</p>
            </div>
            
            <div className="form-group">
              <label>Drink Image</label>
              <div className="current-image">
                <img src={currentDrink.image} alt="Current" />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={closeModal}>Cancel</button>
              <button className="save-btn" onClick={handleUpdate}>Update Drink</button>
            </div>
          </div>
        </div>
      )}

      {!isLoggedIn && (
        <div className="auth-prompt">
          <p>Want to create your own drinks? <a href="/sign-in">Sign in</a> to create custom recipes.</p>
        </div>
      )}
    </div>
  );
};

export default Drinks;