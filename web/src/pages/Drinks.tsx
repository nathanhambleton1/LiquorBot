import React, { useState, useEffect, useCallback } from 'react';
import './styles/Drinks.css';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import { getUrl, uploadData } from 'aws-amplify/storage';
import { Amplify } from 'aws-amplify';
import config from '../amplifyconfiguration.json';
import { createCustomRecipe, updateCustomRecipe, deleteCustomRecipe } from '../graphql/mutations';
import { listCustomRecipes } from '../graphql/queries';
import { FiSearch, FiChevronDown, FiPlus, FiInfo, FiTrash2 } from 'react-icons/fi';

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

// Drink colors for ingredient indicators
const DRINK_COLOURS = ['#d72638', '#f5be41', '#e97451', '#57c84d', '#1e90ff'];

interface DrinksProps {
  onShowAuth?: () => void;
}

const Drinks: React.FC<DrinksProps> = ({ onShowAuth }) => {
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
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  const [currentIngredientIndex, setCurrentIngredientIndex] = useState<number | null>(null);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [createIngredients, setCreateIngredients] = useState<{id: number; amount: number; priority: number}[]>([]);
  const [editIngredients, setEditIngredients] = useState<{id: number; amount: number; priority: number}[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  // Search state
  const [search, setSearch] = useState('');

  // Toggle for custom drinks only
  const [showCustomOnly, setShowCustomOnly] = useState(false);

  // Add showInfoIndex state for info popup
  const [showInfoIndex, setShowInfoIndex] = useState<number | null>(null);

  // Error validation states
  const [formError, setFormError] = useState<string | null>(null);
  const [formShake, setFormShake] = useState(false);

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await getCurrentUser();
        setIsLoggedIn(true);
        fetchCustomDrinks(); // Ensure this is called
      } catch {
        setIsLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
    fetchStandardDrinks(); // Ensure this is called
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
          
          const ingredientsString = item.ingredients
            .map((ing: any) => `${ing.ingredientID}:${ing.amount}:${ing.priority}`)
            .join(',');

          return {
            id: item.id,
            recipeId: item.id,
            name: item.name,
            description: item.description || '',
            image: imageUrl,
            isCustom: true,
            ingredients: ingredientsString
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
    if (!name.trim()) {
      setFormError('Please enter a drink name.');
      setFormShake(true);
      setTimeout(() => setFormShake(false), 600);
      return;
    }
    
    setSaving(true); // NEW: Show loading
    
    try {
      let imageKey = '';
      if (imageFile) {
        const key = `drink-images/${Date.now()}-${imageFile.name}`;
        await uploadData({
          key,
          data: imageFile,
          options: { contentType: imageFile.type }
        }).result;
        imageKey = key;
      }

      // FIX: Properly format ingredients
      const ingredientsInput = createIngredients
        .filter(ing => ing.id !== 0)
        .map(ing => ({
          ingredientID: ing.id.toString(),
          amount: ing.amount,
          priority: ing.priority
        }));

      await client.graphql({
        query: createCustomRecipe,
        variables: {
          input: {
            name,
            description: description || null,
            image: imageKey || null,
            ingredients: ingredientsInput
          }
        },
        authMode: 'userPool'
      });

      fetchCustomDrinks();
      setShowCreateModal(false); // NEW: Close modal after save
    } catch (error) {
      console.error('Error creating drink:', error);
    } finally {
      setSaving(false); // NEW: Hide loading
    }
  };

  // Handle update drink
  const handleUpdate = async () => {
    if (!currentDrink || !name) return;
    
    // FIX: Properly format ingredients
    const ingredientsInput = editIngredients
      .filter(ing => ing.id !== 0)
      .map(ing => ({
        ingredientId: ing.id.toString(),
        amount: ing.amount,
        priority: ing.priority
      }));

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
            ingredients: ingredientsInput
          }
        },
        authMode: 'userPool'
      });
      
      // Refresh list
      fetchCustomDrinks();
      setShowEditModal(false); // Close modal after save
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
    setCreateIngredients([{ id: 0, amount: 1.5, priority: 1 }]);
    setImageFile(null);
    setImagePreview('');
    setShowCreateModal(true);
  };

  // Open edit modal
  const openEditModal = (drink: CustomDrink) => {
    setCurrentDrink(drink);
    setName(drink.name);
    setDescription(drink.description || '');
    
    // Parse ingredients for editing
    const parsedIngredients = parseIngredients(drink.ingredients || '');
    setEditIngredients(parsedIngredients.length ? parsedIngredients : [{ id: 0, amount: 1.5, priority: 1 }]);
    
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

  // Add ingredient row handlers
  const handleIngredientChange = (index: number, field: string, value: any) => {
    if (showCreateModal) {
      setCreateIngredients(prev => prev.map((ing, i) => 
        i === index ? { ...ing, [field]: value } : ing
      ));
    } else {
      setEditIngredients(prev => prev.map((ing, i) => 
        i === index ? { ...ing, [field]: value } : ing
      ));
    }
  };

  const addIngredientRow = () => {
    if (showCreateModal) {
      setCreateIngredients(prev => [...prev, { id: 0, amount: 1.5, priority: 1 }]);
    } else {
      setEditIngredients(prev => [...prev, { id: 0, amount: 1.5, priority: 1 }]);
    }
  };

  const removeIngredientRow = (index: number) => {
    if (showCreateModal) {
      setCreateIngredients(prev => prev.filter((_, i) => i !== index));
    } else {
      setEditIngredients(prev => prev.filter((_, i) => i !== index));
    }
  };
  
  // Add ingredient selection handler
  const handleSelectIngredient = (ingredientId: number) => {
    if (currentIngredientIndex === null) return;
    
    if (showCreateModal) {
      setCreateIngredients(prev => prev.map((ing, i) => 
        i === currentIngredientIndex ? { ...ing, id: ingredientId } : ing
      ));
    } else {
      setEditIngredients(prev => prev.map((ing, i) => 
        i === currentIngredientIndex ? { ...ing, id: ingredientId } : ing
      ));
    }
    
    setShowIngredientPicker(false);
    setIngredientSearch('');
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

  // Ingredient Picker Modal component
  const IngredientPickerModal = () => {
    const categories = ['All', 'Alcohol', 'Mixer', 'Sour', 'Sweet', 'Misc'];
    
    const filteredIngredients = ingredientsList.filter(ingredient => {
      const matchesSearch = ingredient.name.toLowerCase().includes(ingredientSearch.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || ingredient.type === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    return (
      <div className="modal-overlay">
        <div className="drink-modal" style={{ maxWidth: '800px' }}>
          <button className="close-modal" onClick={() => setShowIngredientPicker(false)}>×</button>
          <h2>Select Ingredient</h2>
          
          <div className="form-group">
            <div className="category-selector-bar">
              {categories.map(category => (
                <button
                  key={category}
                  className={`category-text-btn${selectedCategory === category ? ' selected' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                  type="button"
                >
                  {category}
                </button>
              ))}
            </div>
            
            <div className="search-bar-container" style={{ marginTop: '10px', position: 'relative' }}>
              <input
                type="text"
                className="modal-input"
                placeholder="Search ingredients..."
                value={ingredientSearch}
                onChange={e => setIngredientSearch(e.target.value)}
                autoFocus={true}
                style={{ paddingRight: '40px', width: '100%' }}
              />
              <FiSearch style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            </div>
          </div>
          
          <div className="ingredient-grid" style={{ height: '520px', minHeight: '200px', maxHeight: '100%', overflowY: 'auto' }}>
            {filteredIngredients.map(ingredient => (
              <div 
                key={ingredient.id}
                className="ingredient-item"
                onClick={() => handleSelectIngredient(ingredient.id)}
              >
                <div className="ingredient-color" style={{ backgroundColor: DRINK_COLOURS[ingredient.id % 5] }}></div>
                <span>{ingredient.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Remove reload-on-signin logic and instead refetch drinks on login state change
  useEffect(() => {
    if (isLoggedIn) {
      fetchCustomDrinks();
    } else {
      setCustomDrinks([]); // Clear custom drinks on sign out
    }
  }, [isLoggedIn]);

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
            {isLoggedIn && (
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
            )}
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
          <div className={`drink-modal${formShake ? ' shake' : ''}`} style={{ maxWidth: 500, width: '90%' }}>
            <button className="close-modal" onClick={closeModal}>×</button>
            <h2>Create Custom Drink</h2>
            {formError && (
              <div className="modal-error" style={{ marginBottom: 16 }}>{formError}</div>
            )}
            
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
              <label>Ingredients</label>
              {createIngredients.map((ingredient, index) => (
                <div key={index} className="ingredient-row" style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      className="ingredient-selector"
                      onClick={() => { setCurrentIngredientIndex(index); setShowIngredientPicker(true); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: '#2c2c2c', borderRadius: 12, padding: '0.5rem 1.25rem', minWidth: 180, flex: 1, cursor: 'pointer', fontWeight: 500
                      }}
                    >
                      <span className="ingredient-name" style={{ color: ingredient.id ? '#fff' : '#8f8f8f' }}>{ingredient.id ? getIngredientName(ingredient.id) : 'Select Ingredient'}</span>
                      <FiPlus className="selector-icon" style={{ marginLeft: 12, color: '#ce975e', fontSize: 20 }} />
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => removeIngredientRow(index)}
                      disabled={createIngredients.length <= 1}
                      aria-label="Remove ingredient"
                      style={{ color: '#d72638', background: 'none', border: 'none', marginLeft: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                  <div className="stepper-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 12, justifyContent: 'flex-start' }}>
                    {/* Volume Stepper */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 90 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="stepper-btn" onClick={() => handleIngredientChange(index, 'amount', Math.max(0.25, ingredient.amount - 0.25))} style={{ background: '#2c2c2c', color: '#fff', borderRadius: 8, minWidth: 38, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, }}>-</button>
                        <span style={{ background: '#2c2c2c', color: '#fff', borderRadius: 8, minWidth: 38, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16,}}>{ingredient.amount.toFixed(2)}</span>
                        <button className="stepper-btn" onClick={() => handleIngredientChange(index, 'amount', ingredient.amount + 0.25)} style={{ background: '#2c2c2c', color: '#fff', borderRadius: 8, minWidth: 38, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, }}>+</button>
                      </div>
                      <span style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 4 }}>Volume (oz)</span>
                    </div>
                    {/* Priority Stepper */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 90 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="stepper-btn" onClick={() => handleIngredientChange(index, 'priority', Math.max(1, ingredient.priority - 1))} style={{ background: '#2c2c2c', color: '#fff', borderRadius: 8, minWidth: 38, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, }}>-</button>
                        <span style={{ background: '#2c2c2c', color: '#fff', borderRadius: 8, minWidth: 38, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, }}>{ingredient.priority}</span>
                        <button className="stepper-btn" onClick={() => handleIngredientChange(index, 'priority', Math.min(9, ingredient.priority + 1))} style={{ background: '#2c2c2c', color: '#fff', borderRadius: 8, minWidth: 38, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, }}>+</button>
                        {/* Info Button - inline after priority plus */}
                        <button
                          type="button"
                          aria-label="Info"
                          onClick={() => setShowInfoIndex(index)}
                          style={{
                            background: 'none', border: 'none', color: '#444', marginLeft: 8, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
                          }}
                        >
                          <FiInfo />
                        </button>
                      </div>
                      <span style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 4 }}>Priority</span>
                    </div>
                  </div>
                  {/* Info Modal Overlay */}
                  {showInfoIndex === index && (
                    <div className="modal-overlay" style={{ zIndex: 1000 }}>
                      <div className="drink-modal" style={{ maxWidth: 360, width: '90%', textAlign: 'left', padding: '2rem 2rem 1.5rem 2rem', position: 'relative' }}>
                        <button className="close-modal" onClick={() => setShowInfoIndex(null)} style={{ position: 'absolute', right: 16, top: 12, fontSize: 22 }}>×</button>
                        <div style={{ fontWeight: 600, fontSize: 18, color: '#ce975e', marginBottom: 10 }}>Ingredient Info</div>
                        <div style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 10 }}>
                          <b>Volume</b>: Represents the amount of each ingredient, in increments of 0.25 ounces. All measurements are in ounces (oz).
                          <br /><br />
                          <b>Priority</b>: Determines the pour order. Higher priority (1) pours first, while higher numbers pour later.
                        </div>
                        <div style={{ fontSize: 13, color: '#aaa', marginTop: 6, lineHeight: 1.6 }}>
                          <b>Example:</b> In a Tequila Sunrise, grenadine is given higher priority (1) so it's poured first, creating a lovely gradient as orange juice (2) is added on top.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <button className="add-ingredient-btn" onClick={addIngredientRow} style={{ background: 'none', border: 'none', color: '#ce975e', fontWeight: 600, fontSize: 16, padding: 0, marginTop: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FiPlus style={{ color: '#ce975e' }} /> Add Ingredient
              </button>
            </div>
            
            <div className="form-group">
              <label>Drink Image</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label htmlFor="drink-image-upload" style={{
                  background: '#232323', color: '#ce975e', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 15, border: '1px solid #444', display: 'inline-block',
                }}>
                  {imageFile ? 'Change Image' : 'Choose Image'}
                </label>
                <input
                  id="drink-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
                <span style={{ color: '#aaa', fontSize: 14, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {imageFile ? imageFile.name : 'No file chosen'}
                </span>
              </div>
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button 
                className="save-btn" 
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner"></span> Saving...
                  </>
                ) : (
                  'Create Drink'
                )}
              </button>
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
              <label>Ingredients</label>
              {editIngredients.map((ingredient, index) => (
                <div key={index} className="ingredient-row" style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      className="ingredient-selector"
                      onClick={() => { setCurrentIngredientIndex(index); setShowIngredientPicker(true); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: '#f2f2f2', borderRadius: 12, padding: '0.5rem 1.25rem', minWidth: 180, flex: 1, cursor: 'pointer',
                        border: '1px solid #e0e0e0', fontWeight: 500
                      }}
                    >
                      <span className="ingredient-name" style={{ color: ingredient.id ? '#fff' : '#8f8f8f' }}>{ingredient.id ? getIngredientName(ingredient.id) : 'Select Ingredient'}</span>
                      <button
                        className="ingredient-plus-btn"
                        onClick={e => { e.stopPropagation(); setCurrentIngredientIndex(index); setShowIngredientPicker(true); }}
                        style={{ background: '#393939', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 12, cursor: 'pointer' }}
                        aria-label="Select Ingredient"
                        type="button"
                      >
                        <FiPlus style={{ color: '#f5be41', fontSize: 18 }} />
                      </button>
                    </div>
                    <button
                      className="control-btn remove-btn"
                      onClick={() => removeIngredientRow(index)}
                      disabled={editIngredients.length <= 1}
                      aria-label="Remove ingredient"
                      style={{ color: '#d72638', background: 'none', border: 'none', marginLeft: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                  <div className="stepper-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 40, marginTop: 12, justifyContent: 'flex-start', position: 'relative' }}>
                    {/* Volume Stepper */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 90 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="stepper-btn" onClick={() => handleIngredientChange(index, 'amount', Math.max(0.25, ingredient.amount - 0.25))} style={{ background: '#f2f2f2', borderRadius: 8, border: 'none', width: 32, height: 32, fontSize: 20, color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                        <span style={{ background: '#f2f2f2', color: '#333', borderRadius: 8, minWidth: 38, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, border: '1px solid #e0e0e0' }}>{ingredient.amount.toFixed(2)}</span>
                        <button className="stepper-btn" onClick={() => handleIngredientChange(index, 'amount', ingredient.amount + 0.25)} style={{ background: '#f2f2f2', borderRadius: 8, border: 'none', width: 32, height: 32, fontSize: 20, color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                      <span style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 4 }}>Volume</span>
                    </div>
                    {/* Priority Stepper */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 90 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="stepper-btn" onClick={() => handleIngredientChange(index, 'priority', Math.max(1, ingredient.priority - 1))} style={{ background: '#f2f2f2', borderRadius: 8, border: 'none', width: 32, height: 32, fontSize: 20, color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                        <span style={{ background: '#f2f2f2', color: '#333', borderRadius: 8, minWidth: 38, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, border: '1px solid #e0e0e0' }}>{ingredient.priority}</span>
                        <button className="stepper-btn" onClick={() => handleIngredientChange(index, 'priority', Math.min(9, ingredient.priority + 1))} style={{ background: '#f2f2f2', borderRadius: 8, border: 'none', width: 32, height: 32, fontSize: 20, color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                      <span style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 4 }}>Priority</span>
                    </div>
                    {/* Info Button */}
                    <button
                      className="info-btn"
                      onClick={() => setShowInfoIndex(index)}
                      style={{ position: 'absolute', right: 0, top: 0, background: 'none', border: 'none', color: '#f5be41', fontSize: 22, cursor: 'pointer', padding: 4 }}
                      aria-label="Info about volume and priority"
                      type="button"
                    >
                      <FiInfo />
                    </button>
                    {showInfoIndex === index && (
                      <div style={{ position: 'absolute', right: 0, top: 36, background: '#232323', color: '#fff', borderRadius: 10, boxShadow: '0 2px 12px #0008', padding: '1rem', zIndex: 10, minWidth: 260 }}>
                        <div style={{ fontWeight: 600, marginBottom: 6, color: '#f5be41' }}>How does this work?</div>
                        <div style={{ fontSize: 15, marginBottom: 8 }}><b>Volume</b> is the amount in ounces for each ingredient.</div>
                        <div style={{ fontSize: 15 }}><b>Priority</b> controls the pouring order (1 = first, 9 = last). Lower numbers are poured first.</div>
                        <button onClick={() => setShowInfoIndex(null)} style={{ marginTop: 10, background: '#393939', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', fontWeight: 600 }}>Close</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              <button className="add-ingredient-btn" onClick={addIngredientRow} style={{ background: 'none', border: 'none', color: '#f5be41', fontWeight: 600, fontSize: 16, padding: 0, marginTop: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FiPlus style={{ color: '#f5be41' }} /> Add Ingredient
              </button>
            </div>
            
            <div className="form-group">
              <label>Drink Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {(imagePreview || currentDrink.image) && (
                <div className="image-preview">
                  <img src={imagePreview || currentDrink.image} alt="Preview" />
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button 
                className="save-btn" 
                onClick={handleUpdate}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner"></span> Saving...
                  </>
                ) : (
                  'Create Drink'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ingredient Picker Modal */}
      {showIngredientPicker && <IngredientPickerModal />}

      {!isLoggedIn && (
        <div className="auth-prompt">
          <p>Want to create your own drinks?{' '}
            <button
              className="sign-in-btn"
              type="button"
              onClick={onShowAuth}
              style={{
                background: 'none',
                border: 'none',
                color: '#ce975e',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline',
                fontSize: 'inherit',
                padding: 0,
                transition: 'color 0.2s',
              }}
              onMouseOver={e => (e.currentTarget.style.color = '#fff')}
              onMouseOut={e => (e.currentTarget.style.color = '#ce975e')}
            >
              Sign in
            </button>{' '}to create custom recipes.
          </p>
        </div>
      )}
    </div>
  );
};

export default Drinks;