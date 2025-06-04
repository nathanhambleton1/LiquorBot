// File: src/EventsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { listEvents, getEvent, getCustomRecipe } from '../graphql/queries';
import { deleteEvent, joinEvent, createEvent, updateEvent, leaveEvent } from '../graphql/mutations';
import { fetchAuthSession } from '@aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';
import './styles/EventsPage.css';
import { FiEdit2, FiTrash2, FiLogOut, FiPlus, FiX, FiCalendar } from 'react-icons/fi';

const client = generateClient();

interface Drink {
  id: number;
  name: string;
  category: string;
  ingredients?: string;
}

interface CustomRecipe {
  id: string;
  name: string;
  ingredients?: { ingredientID: number }[];
}

interface Event {
  id: string;
  name: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  inviteCode: string;
  owner: string;
  guestOwners?: string[];
  liquorbotId: number;
  drinkIDs?: number[];
  customRecipeIDs?: string[];
}

interface Ingredient {
  id: number;
  name: string;
  type: string;
  ingredients?: string;
}

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [eventToLeave, setEventToLeave] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [standardDrinks, setStandardDrinks] = useState<Drink[]>([]);
  const [customRecipes, setCustomRecipes] = useState<Record<string, CustomRecipe>>({});
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [copiedLinkEventId, setCopiedLinkEventId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDrinkPicker, setShowDrinkPicker] = useState(false);
  const [drinkSearch, setDrinkSearch] = useState('');
  const [drinkCategory, setDrinkCategory] = useState('All');
  const [ingredientsList, setIngredientsList] = useState<Ingredient[]>([]);
  const [showSlots, setShowSlots] = useState(false);
  const [ingredientSet, setIngredientSet] = useState<Set<number>>(new Set());
  const [slotsOK, setSlotsOK] = useState(true);
  // Error feedback for drink selection
  const [errorItemId, setErrorItemId] = useState<number | string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  // Validation error state for event forms
  const [formError, setFormError] = useState<string | null>(null);
  const [formShake, setFormShake] = useState(false);
  
  // Form states
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventDeviceId, setEventDeviceId] = useState('');
  const [selectedDrinkIds, setSelectedDrinkIds] = useState<number[]>([]);
  const [selectedCustomIds, setSelectedCustomIds] = useState<string[]>([]);

  const categories = ['All', 'Vodka', 'Rum', 'Tequila', 'Whiskey', 'Gin', 'Brandy', 'Liqueur', 'Custom'];

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const session = await fetchAuthSession();
        const username = typeof session.tokens?.idToken?.payload['cognito:username'] === 'string' 
          ? session.tokens?.idToken?.payload['cognito:username'] 
          : null;
        setCurrentUser(username);
        
        const groups = session.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;
        setIsAdmin(groups?.includes('ADMIN') || false);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const fetchStandardDrinks = async () => {
      try {
        const url = await getUrl({ key: 'drinkMenu/drinks.json' });
        const response = await fetch(url.url);
        const data = await response.json();
        setStandardDrinks(data);
      } catch (error) {
        console.error('Error fetching standard drinks:', error);
      }
    };

    fetchStandardDrinks();
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    try {
      const { data } = await client.graphql({
        query: listEvents,
        authMode: 'userPool'
      });
      
      const userEvents = (data.listEvents.items || [])
        .filter((item: any) => {
          // Fix 2: Only include events where user is owner or guest
          return (
            item.owner === currentUser || 
            (item.guestOwners && item.guestOwners.includes(currentUser))
          );
        })
        .map((item: any) => ({
          ...item,
          description: item.description ?? undefined,
          location: item.location ?? undefined,
          liquorbotId: item.liquorbotId,
          guestOwners: Array.isArray(item.guestOwners) 
            ? item.guestOwners.filter((g: any) => typeof g === 'string') 
            : [],
          drinkIDs: item.drinkIDs || [],
          customRecipeIDs: item.customRecipeIDs || [],
        }));

      setEvents(userEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const fetchCustomRecipes = useCallback(async (ids: string[]) => {
    const newRecipes: Record<string, CustomRecipe> = {};
    
    for (const id of ids) {
      if (!customRecipes[id]) {
        try {
          const { data } = await client.graphql({
            query: getCustomRecipe,
            variables: { id },
            authMode: 'apiKey'
          });
          
          if (data?.getCustomRecipe) {
            newRecipes[id] = {
              id: data.getCustomRecipe.id,
              name: data.getCustomRecipe.name
            };
          }
        } catch (error) {
          console.error(`Error fetching custom recipe ${id}:`, error);
          newRecipes[id] = { id, name: `Custom Drink (${id.slice(0, 6)})` };
        }
      }
    }
    
    setCustomRecipes(prev => ({ ...prev, ...newRecipes }));
  }, [customRecipes]);

  useEffect(() => {
    if (expandedEventId) {
      const event = events.find(e => e.id === expandedEventId);
      if (event?.customRecipeIDs?.length) {
        const missingIds = event.customRecipeIDs.filter(id => !customRecipes[id]);
        if (missingIds.length > 0) {
          fetchCustomRecipes(missingIds);
        }
      }
    }
  }, [expandedEventId, events, customRecipes, fetchCustomRecipes]);

  const handleJoinEvent = async () => {
    if (!inviteCode.trim()) return;
    
    try {
      await client.graphql({
        query: joinEvent,
        variables: { inviteCode: inviteCode.trim() },
        authMode: 'userPool'
      });
      
      fetchEvents();
      setShowJoinModal(false);
      setInviteCode('');
    } catch (error) {
      console.error('Error joining event:', error);
      alert('Could not join event. Please check the invite code.');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    setEventToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      await client.graphql({
        query: deleteEvent,
        variables: { input: { id: eventToDelete } },
        authMode: 'userPool'
      });
      // Fix 5: Refetch after deletion
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      // Fix 6: Refetch on error
      fetchEvents();
    } finally {
      setShowDeleteModal(false);
      setEventToDelete(null);
    }
  };

  const cancelDeleteEvent = () => {
    setShowDeleteModal(false);
    setEventToDelete(null);
  };

  const openEditModal = async (eventId: string) => {
    try {
      const { data } = await client.graphql({
        query: getEvent,
        variables: { id: eventId },
        authMode: 'userPool'
      });
      const eventRaw = data.getEvent ?? null;
      const event: Event | null = eventRaw
        ? {
            ...eventRaw,
            description: eventRaw.description ?? undefined,
            location: eventRaw.location ?? undefined,
            guestOwners: Array.isArray(eventRaw.guestOwners) ? eventRaw.guestOwners.filter((g: any) => typeof g === 'string') : [],
            drinkIDs: Array.isArray(eventRaw.drinkIDs) ? eventRaw.drinkIDs.filter((id: any): id is number => typeof id === 'number') : [],
            customRecipeIDs: Array.isArray(eventRaw.customRecipeIDs) ? eventRaw.customRecipeIDs.filter((id: any): id is string => typeof id === 'string') : [],
          }
        : null;
      setCurrentEvent(event);
      if (event) {
        setEventName(event.name);
        setEventDescription(event.description || '');
        setEventLocation(event.location || '');
        setEventStartTime(event.startTime.substring(0, 16));
        setEventEndTime(event.endTime.substring(0, 16));
        setEventDeviceId(event.liquorbotId.toString());
        setSelectedDrinkIds(event.drinkIDs || []);
        setSelectedCustomIds(event.customRecipeIDs || []);
        setShowEditModal(true);
      }
    } catch (error) {
      console.error('Error fetching event for edit:', error);
    }
  };

  const handleCreateEvent = async () => {
    // Validate required fields
    if (!eventName.trim()) {
      setFormError('Event name is required');
      setFormShake(true);
      setTimeout(() => { setFormShake(false); }, 500);
      return;
    }
    if (!eventStartTime || !eventEndTime) {
      setFormError('Start and end time are required');
      setFormShake(true);
      setTimeout(() => { setFormShake(false); }, 500);
      return;
    }
    // New: Validate device ID and drink selection
    if (!eventDeviceId.trim()) {
      setFormError('Device ID is required');
      setFormShake(true);
      setTimeout(() => { setFormShake(false); }, 500);
      return;
    }
    if (!/^\d{1}$/.test(eventDeviceId.trim())) {
      setFormError('Device ID must be a 6-digit number');
      setFormShake(true);
      setTimeout(() => { setFormShake(false); }, 500);
      return;
    }
    if (selectedDrinkIds.length + selectedCustomIds.length === 0) {
      setFormError('At least one drink must be selected');
      setFormShake(true);
      setTimeout(() => { setFormShake(false); }, 500);
      return;
    }
    try {
      setFormError(null);
      await client.graphql({
        query: createEvent,
        variables: {
          input: {
            name: eventName,
            description: eventDescription || null,
            location: eventLocation || null,
            startTime: new Date(eventStartTime).toISOString(),
            endTime: new Date(eventEndTime).toISOString(),
            liquorbotId: parseInt(eventDeviceId, 10),
            inviteCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
            owner: currentUser || '',
            drinkIDs: selectedDrinkIds,
            customRecipeIDs: selectedCustomIds
          }
        },
        authMode: 'userPool'
      });
      
      fetchEvents();
      setShowCreateModal(false);
      resetEventForm();
      setFormError(null);
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const handleUpdateEvent = async () => {
    if (!currentEvent || !eventName.trim()) return;
    if (!eventName.trim()) {
      setFormError('Event name is required');
      setFormShake(true);
      setTimeout(() => { setFormShake(false); }, 500);
      return;
    }
    // New: Validate device ID and drink selection before update
    if (!eventDeviceId.trim()) {
      setFormError('Device ID is required');
      setFormShake(true);
      setTimeout(() => { setFormShake(false); }, 500);
      return;
    }
    if (!/^\d{1}$/.test(eventDeviceId.trim())) {
      setFormError('Device ID must be a 6-digit number');
      setFormShake(true);
      setTimeout(() => { setFormShake(false); }, 500);
      return;
    }
    if (selectedDrinkIds.length + selectedCustomIds.length === 0) {
      setFormError('At least one drink must be selected');
      setFormShake(true);
      setTimeout(() => { setFormShake(false); }, 500);
      return;
    }
    setIsUpdating(true);
    try {
      setFormError(null);
      await client.graphql({
        query: updateEvent,
        variables: {
          input: {
            id: currentEvent.id,
            name: eventName,
            description: eventDescription || null,
            location: eventLocation || null,
            startTime: new Date(eventStartTime).toISOString(),
            endTime: new Date(eventEndTime).toISOString(),
            liquorbotId: parseInt(eventDeviceId, 10),
            drinkIDs: selectedDrinkIds,
            customRecipeIDs: selectedCustomIds
          }
        },
        authMode: 'userPool'
      });

      fetchEvents();
      resetEventForm();
      setFormError(null);
    } catch (error) {
      console.error('Error updating event:', error);
    } finally {
      setIsUpdating(false);
      setShowEditModal(false);
    }
  };

  const handleLeaveEvent = (id: string) => {
    setEventToLeave(id);
    setShowLeaveModal(true);
  };

  const confirmLeaveEvent = async () => {
    if (!eventToLeave) return;
    setIsLeaving(true);
    try {
      await client.graphql({
        query: leaveEvent,
        variables: { eventId: eventToLeave },
        authMode: 'userPool'
      });
      // Fix 3: Refetch events after leaving
      fetchEvents();
    } catch (error) {
      console.error('Error leaving event:', error);
      // Fix 4: Refetch even on error to ensure consistency
      fetchEvents();
    } finally {
      setIsLeaving(false);
      setShowLeaveModal(false);
      setEventToLeave(null);
    }
  };

  const cancelLeaveEvent = () => {
    setShowLeaveModal(false);
    setEventToLeave(null);
  };

  const resetEventForm = () => {
    setEventName('');
    setEventDescription('');
    setEventLocation('');
    setEventStartTime('');
    setEventEndTime('');
    setEventDeviceId('');
    setSelectedDrinkIds([]);
    setSelectedCustomIds([]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const toggleExpand = (id: string) => {
    if (expandedEventId === id) {
      setExpandedEventId(null);
    } else {
      setExpandedEventId(id);
    }
  };

  // Copy for invite code
  const copyInviteCodeToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEventId(id);
    setTimeout(() => setCopiedEventId(null), 2000);
  };

  // Copy for event link
  const copyLinkToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLinkEventId(id);
    setTimeout(() => setCopiedLinkEventId(null), 2000);
  };

  const filteredDrinks = () => {
    let drinks = [...standardDrinks];
    
    if (drinkCategory !== 'All' && drinkCategory !== 'Custom') {
      drinks = drinks.filter(d => d.category === drinkCategory);
    }
    
    if (drinkSearch) {
      const query = drinkSearch.toLowerCase();
      drinks = drinks.filter(d => 
        d.name.toLowerCase().includes(query) || 
        d.category.toLowerCase().includes(query)
      );
    }
    
    return drinks;
  };

  const addDrinkToEvent = (id: number) => {
    const drink = standardDrinks.find(d => d.id === id);
    if (drink && !canAddDrink(drink)) {
      // Trigger shake and show message
      setErrorItemId(id);
      setErrorMessage('Cannot add: exceeds 15 unique ingredients');
      setTimeout(() => setErrorItemId(null), 2000);
      return;
    }
    setSelectedDrinkIds(prev => [...prev, id]);
  };

  const addCustomToEvent = (id: string) => {
    const recipe = customRecipes[id];
    if (recipe && !canAddDrink(recipe)) {
      // Trigger shake and show message
      setErrorItemId(id);
      setErrorMessage('Cannot add: exceeds 15 unique ingredients');
      setTimeout(() => setErrorItemId(null), 2000);
      return;
    }
    setSelectedCustomIds(prev => [...prev, id]);
  };

  const removeDrink = (id: number) => {
    setSelectedDrinkIds(prev => prev.filter(d => d !== id));
  };

  const removeCustom = (id: string) => {
    setSelectedCustomIds(prev => prev.filter(c => c !== id));
  };

  const getDrinkName = (id: number) => {
    const drink = standardDrinks.find(d => d.id === id);
    return drink ? drink.name : `Drink #${id}`;
  };

  const getCustomName = (id: string) => {
    return customRecipes[id]?.name || `Custom Recipe #${id.slice(0, 6)}`;
  };

  // Fetch ingredients list
  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        const url = await getUrl({ key: 'drinkMenu/ingredients.json' });
        const response = await fetch(url.url);
        const data = await response.json();
        setIngredientsList(data);
      } catch (error) {
        console.error('Error fetching ingredients:', error);
      }
    };
    
    fetchIngredients();
  }, []);

  // Function to parse ingredients from a drink
  const parseIngredients = (item: Drink | CustomRecipe): number[] => {
    if ('ingredients' in item && typeof item.ingredients === 'string') {
      // Parse standard drink ingredients
      return item.ingredients.split(',').map((part: string): number => {
        const [idStr]: string[] = part.split(':');
        return parseInt(idStr, 10);
      });
    } else if ('ingredients' in item && Array.isArray(item.ingredients)) {
      // Parse custom recipe ingredients
      return item.ingredients.map(ing => ing.ingredientID);
    }
    return [];
  };

  // Function to calculate ingredient set
  const calculateIngredientSet = useCallback(() => {
    const newSet = new Set<number>();
    
    // Process standard drinks
    selectedDrinkIds.forEach(id => {
      const drink = standardDrinks.find(d => d.id === id);
      if (drink) {
        parseIngredients(drink).forEach(ingId => newSet.add(ingId));
      }
    });
    
    // Process custom recipes
    selectedCustomIds.forEach(id => {
      const recipe = customRecipes[id];
      if (recipe) {
        parseIngredients(recipe).forEach(ingId => newSet.add(ingId));
      }
    });
    
    setIngredientSet(newSet);
    setSlotsOK(newSet.size <= 15);
  }, [selectedDrinkIds, selectedCustomIds, standardDrinks, customRecipes]);

  useEffect(() => {
    calculateIngredientSet();
  }, [selectedDrinkIds, selectedCustomIds, standardDrinks, customRecipes, calculateIngredientSet]);

  // Function to check if adding a drink would exceed the limit
  const canAddDrink = (item: Drink | CustomRecipe): boolean => {
    const tempSet = new Set(ingredientSet);
    const itemIngredients = parseIngredients(item);
    itemIngredients.forEach(ingId => tempSet.add(ingId));
    return tempSet.size <= 15;
  };

  const IngredientSlots = () => (
    <div className="slots-section">
      <div 
        className="slots-header"
        onClick={() => setShowSlots(!showSlots)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        <span style={{ color: slotsOK ? '#cecece' : '#d9534f' }}>
          {ingredientSet.size}/15 unique ingredients
        </span>
        {ingredientSet.size > 0 && (
          <span style={{ marginLeft: 8 }}>
            {showSlots ? '▲' : '▼'}
          </span>
        )}
      </div>
      
      {showSlots && (
        <div className="slot-box">
          {Array.from(ingredientSet).sort((a, b) => a - b).map((id, i) => {
            const ing = ingredientsList.find(x => x.id === id);
            return (
              <div key={id} className="slot-line">
                Slot {i + 1}: {ing?.name || `Ingredient ${id}`}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="events-container">
        <div className="spinner-container">
          <div className="spinner"></div>
          <div style={{marginTop: 16}}>Loading events...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="events-container" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh'}}>
        <FiCalendar size={64} style={{ marginBottom: 16, color: '#ce975e', textAlign: 'center' }} />
        <h2 style={{marginBottom: 12, textAlign: 'center'}}>You must sign in to view your events</h2>
        <p style={{color: '#cecece', maxWidth: 400, marginBottom: 28, fontSize: 16, textAlign: 'center'}}>
          Sign in to create, join, and manage your events. You'll be able to see your upcoming parties, share invite codes, and keep track of all your cocktail gatherings in one place.
        </p>
        <button
          className="lb-btn"
          onClick={() => {
            if (window && typeof window.dispatchEvent === 'function') {
              window.dispatchEvent(new CustomEvent('show-signin-modal'));
            }
          }}
          style={{marginTop: 0, minWidth: 160, fontSize: 18, textAlign: 'center', display: 'flex', justifyContent: 'center'}}
        >
          <span style={{width: '100%', textAlign: 'center'}}>Sign In</span>
        </button>
      </div>
    );
  }

  return (
    <div className="events-container">
      <div className="events-header">
        <h1 className="events-title">Your Events</h1>
        <div className="events-actions">
          <button 
            className="lb-btn" 
            onClick={() => setShowJoinModal(true)}
          >
            Join Event
          </button>
          <button 
            className="lb-btn" 
            onClick={() => {
              resetEventForm();
              setFormError(null);
              setFormShake(false);
              setShowCreateModal(true);
            }}
          >
            New Event
          </button>
        </div>
      </div>

      {!loading && events.length === 0 ? (
        <div className="empty-events">
          <p>You haven't created or joined any events yet</p>
          <p>Create a new event or join one using an invite code</p>
        </div>
      ) : events.length > 0 ? (
        <div className="events-grid">
          {events.map(event => (
            <div
              key={event.id}
              className={expandedEventId === event.id ? 'event-card expanded' : 'event-card'}
            >
              <div
                className="event-card-header"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                onClick={() => toggleExpand(event.id)}
              >
                <div>
                  <h3 className="event-name" style={{ marginBottom: 0 }}>{event.name}</h3>
                  <div className="event-meta">
                    <span>{formatDate(event.startTime)}</span>
                    {event.location && <span> • {event.location}</span>}
                  </div>
                </div>
                <div className="event-card-actions" style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  {event.owner === currentUser ? (
                    <>
                      <button
                        className="icon-btn"
                        title="Edit Event"
                        onClick={() => openEditModal(event.id)}
                        style={{ background: 'none', border: 'none', color: '#ce975e', cursor: 'pointer', padding: 4, borderRadius: 4 }}
                      >
                        <FiEdit2 size={20} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Delete Event"
                        onClick={() => handleDeleteEvent(event.id)}
                        style={{ background: 'none', border: 'none', color: '#d9534f', cursor: 'pointer', padding: 4, borderRadius: 4 }}
                      >
                        <FiTrash2 size={20} />
                      </button>
                    </>
                  ) : (
                    <button
                      className="icon-btn"
                      title="Leave Event"
                      onClick={() => handleLeaveEvent(event.id)}
                      style={{ background: 'none', border: 'none', color: '#d9534f', cursor: 'pointer', padding: 4, borderRadius: 4 }}
                      disabled={isLeaving && eventToLeave === event.id}
                    >
                      {isLeaving && eventToLeave === event.id ? <span className="spinner-btn"></span> : <FiLogOut size={20} />}
                    </button>
                  )}
                </div>
              </div>

              {expandedEventId === event.id && (
                <>
                  <div className="event-expanded-content">
                    {event.description && (
                      <p className="event-description">{event.description}</p>
                    )}

                    <div className="drink-menu-section">
                      <h4>Drink Menu</h4>
                      {event.drinkIDs && event.drinkIDs.length > 0 && (
                        <div className="drink-list">
                          <h5>Standard Drinks</h5>
                          <ul>
                            {event.drinkIDs.map(id => (
                              <li key={`std-${id}`}>{getDrinkName(id)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {event.customRecipeIDs && event.customRecipeIDs.length > 0 && (
                        <div className="drink-list">
                          <h5>Custom Recipes</h5>
                          <ul>
                            {event.customRecipeIDs.map(id => (
                              <li key={`cus-${id}`}>{getCustomName(id)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(event.drinkIDs?.length || 0) + (event.customRecipeIDs?.length || 0) === 0 && (
                        <p>No drinks added to this event yet</p>
                      )}
                    </div>

                    <div className="event-link-section">
                      <h4>Event Link</h4>
                      <div className="invite-link">
                        <span>https://yourapp.com/join/{event.inviteCode}</span>
                        <button
                          className="copy-btn"
                          onClick={() => copyLinkToClipboard(`https://yourapp.com/join/${event.inviteCode}`, event.id)}
                        >
                          {copiedLinkEventId === event.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="device-info">
                        <h4>Device ID</h4>
                        <p>{event.liquorbotId}</p>
                      </div>
                    )}
                  </div>

                  <div className="event-footer" onClick={e => e.stopPropagation()}>
                    <div className="invite-code">
                      <span>Code: {event.inviteCode}</span>
                      <button
                        className="copy-btn small"
                        onClick={() => copyInviteCodeToClipboard(event.inviteCode, event.id)}
                      >
                        {copiedEventId === event.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="drink-count">
                      {(event.drinkIDs?.length || 0) + (event.customRecipeIDs?.length || 0)} drinks
                    </div>
                  </div>
                </>
              )}
              {expandedEventId !== event.id && (
                <div className="event-footer" onClick={e => e.stopPropagation()}>
                  <div className="invite-code">
                    <span>Code: {event.inviteCode}</span>
                    <button
                      className="copy-btn small"
                      onClick={() => copyInviteCodeToClipboard(event.inviteCode, event.id)}
                    >
                      {copiedEventId === event.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="drink-count">
                    {(event.drinkIDs?.length || 0) + (event.customRecipeIDs?.length || 0)} drinks
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Join Event Modal */}
      {showJoinModal && (
        <div className="events-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Join an Event</h3>
              <span 
                className="modal-close" 
                onClick={() => setShowJoinModal(false)}
              >
                &times;
              </span>
            </div>
            <div className="modal-body">
              <input
                type="text"
                className="modal-input"
                placeholder="Enter invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button 
                className="lb-btn secondary"
                onClick={() => setShowJoinModal(false)}
              >
                Cancel
              </button>
              <button 
                className="lb-btn"
                onClick={handleJoinEvent}
              >
                Join Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="events-modal">
          <div className={`modal-content ${formShake ? 'shake' : ''}`}>
            {formError && <div className="modal-error">{formError}</div>}
            <div className="modal-header">
              <h3 className="modal-title">Create New Event</h3>
              <span 
                className="modal-close" 
                onClick={() => setShowCreateModal(false)}
              >
                &times;
              </span>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Event Name</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="Enter event name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="modal-input"
                  placeholder="Enter description"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="Enter location"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                />
              </div>
              {currentUser && (
                <div className="form-group">
                  <label>Device ID</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="Enter 6-digit Device ID"
                    value={eventDeviceId}
                    onChange={(e) => setEventDeviceId(e.target.value)}
                    maxLength={6}
                  />
                </div>
              )}
              <div className="form-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label>Start Time</label>
                  <input
                    type="datetime-local"
                    className="modal-input"
                    style={{ minWidth: 0, maxWidth: '100%' }}
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label>End Time</label>
                  <input
                    type="datetime-local"
                    className="modal-input"
                    style={{ minWidth: 0, maxWidth: '100%' }}
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Drink Menu</label>
                <div className="drink-selection">
                  <button 
                    type="button" 
                    className="lb-btn secondary"
                    onClick={() => setShowDrinkPicker(true)}
                  >
                    <FiPlus /> Add Drinks
                  </button>
                  
                  <div className="selected-drinks">
                    <h4>Selected Drinks</h4>
                    {selectedDrinkIds.length === 0 && selectedCustomIds.length === 0 ? (
                      <p>No drinks selected</p>
                    ) : (
                      <div className="drink-tags">
                        {selectedDrinkIds.map(id => (
                          <span key={`sel-std-${id}`} className="drink-tag">
                            {getDrinkName(id)}
                            <button onClick={() => removeDrink(id)} className="remove-tag">
                              <FiX />
                            </button>
                          </span>
                        ))}
                        {selectedCustomIds.map(id => (
                          <span key={`sel-cus-${id}`} className="drink-tag">
                            {getCustomName(id)}
                            <button onClick={() => removeCustom(id)} className="remove-tag">
                              <FiX />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <IngredientSlots />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="lb-btn secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button 
                className="lb-btn"
                onClick={handleCreateEvent}
                disabled={!slotsOK}
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {showEditModal && currentEvent && (
        <div className="events-modal">
          <div className={`modal-content ${formShake ? 'shake' : ''}`}>
            {formError && <div className="modal-error">{formError}</div>}
            <div className="modal-header">
              <h3 className="modal-title">Edit Event</h3>
              <span 
                className="modal-close" 
                onClick={() => setShowEditModal(false)}
              >
                &times;
              </span>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Event Name</label>
                <input
                  type="text"
                  className="modal-input"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="modal-input"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  className="modal-input"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                />
              </div>
              {currentEvent.owner === currentUser && (
                <div className="form-group">
                  <label>Device ID</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="Enter 6-digit Device ID"
                    value={eventDeviceId}
                    onChange={(e) => setEventDeviceId(e.target.value)}
                    maxLength={6}
                  />
                </div>
              )}
              <div className="form-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label>Start Time</label>
                  <input
                    type="datetime-local"
                    className="modal-input"
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                    style={{ minWidth: 0, maxWidth: '100%' }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label>End Time</label>
                  <input
                    type="datetime-local"
                    className="modal-input"
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    style={{ minWidth: 0, maxWidth: '100%' }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Drink Menu</label>
                <div className="drink-selection">
                  <button 
                    type="button" 
                    className="lb-btn secondary"
                    onClick={() => setShowDrinkPicker(true)}
                  >
                    <FiPlus /> Add Drinks
                  </button>
                  
                  <div className="selected-drinks">
                    <h4>Selected Drinks</h4>
                    {selectedDrinkIds.length === 0 && selectedCustomIds.length === 0 ? (
                      <p>No drinks selected</p>
                    ) : (
                      <div className="drink-tags">
                        {selectedDrinkIds.map(id => (
                          <span key={`sel-std-${id}`} className="drink-tag">
                            {getDrinkName(id)}
                            <button onClick={() => removeDrink(id)} className="remove-tag">
                              <FiX />
                            </button>
                          </span>
                        ))}
                        {selectedCustomIds.map(id => (
                          <span key={`sel-cus-${id}`} className="drink-tag">
                            {getCustomName(id)}
                            <button onClick={() => removeCustom(id)} className="remove-tag">
                              <FiX />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <IngredientSlots />
                </div>
              </div>
              <div className="form-group">
                <label>Invite Code</label>
                <input
                  type="text"
                  className="modal-input"
                  value={currentEvent.inviteCode}
                  readOnly
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="lb-btn secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button 
                className="lb-btn"
                onClick={handleUpdateEvent}
                disabled={isUpdating || !slotsOK}
              >
                {isUpdating ? (<><span className="spinner-btn"></span>Updating...</>) : 'Update Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drink Picker Modal */}
      {showDrinkPicker && (
        <div className="events-modal">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Select Drinks</h3>
              <span 
                className="modal-close" 
                onClick={() => setShowDrinkPicker(false)}
              >
                &times;
              </span>
            </div>
            <div className="modal-body">
              <div className="drink-picker">
                <div className="drink-filter">
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="Search drinks..."
                    value={drinkSearch}
                    onChange={(e) => setDrinkSearch(e.target.value)}
                  />
                  <select
                    value={drinkCategory}
                    onChange={(e) => setDrinkCategory(e.target.value)}
                    className="category-select"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div className="drink-list-container">
                  <h4>Standard Drinks</h4>
                  <div className="drink-grid">
                    {filteredDrinks().map(drink => {
                      const isError = errorItemId === drink.id;
                      return (
                      <div 
                        key={drink.id} 
                        className={`drink-item ${selectedDrinkIds.includes(drink.id) ? 'selected' : ''} ${isError ? 'shake' : ''}`}
                        onClick={() => {
                          if (selectedDrinkIds.includes(drink.id)) {
                            removeDrink(drink.id);
                          } else {
                            addDrinkToEvent(drink.id);
                          }
                        }}
                        style={{ position: 'relative' }}
                      >
                        <div className="drink-info">
                          <div className="drink-name">{drink.name}</div>
                          <div className="drink-category">{drink.category}</div>
                        </div>
                        <div className="drink-action">
                          {selectedDrinkIds.includes(drink.id) ? '✓' : '+'}
                        </div>
                        {isError && (
                          <div className="error-bubble">{errorMessage}</div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                  
                  <h4>Custom Recipes</h4>
                  {Object.keys(customRecipes).length > 0 ? (
                    <div className="drink-grid">
                      {Object.values(customRecipes).map(recipe => {
                        const isErr = errorItemId === recipe.id;
                        return (
                        <div 
                          key={recipe.id} 
                          className={`drink-item ${selectedCustomIds.includes(recipe.id) ? 'selected' : ''} ${isErr ? 'shake' : ''}`}
                          onClick={() => {
                            if (selectedCustomIds.includes(recipe.id)) {
                              removeCustom(recipe.id);
                            } else {
                              addCustomToEvent(recipe.id);
                            }
                          }}
                          style={{ position: 'relative' }}
                        >
                          <div className="drink-info">
                            <div className="drink-name">{recipe.name}</div>
                            <div className="drink-category">Custom</div>
                          </div>
                          <div className="drink-action">
                            {selectedCustomIds.includes(recipe.id) ? '✓' : '+'}
                          </div>
                          {isErr && (
                            <div className="error-bubble">{errorMessage}</div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p>No custom recipes available</p>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="lb-btn"
                onClick={() => setShowDrinkPicker(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Event Modal */}
      {showDeleteModal && (
        <div className="events-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Delete Event</h3>
              <span className="modal-close" onClick={cancelDeleteEvent}>&times;</span>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to remove this event? All users will also be removed. This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="lb-btn secondary" onClick={cancelDeleteEvent}>Cancel</button>
              <button className="lb-btn" style={{background: '#d9534f', color: '#fff'}} onClick={confirmDeleteEvent}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Event Modal */}
      {showLeaveModal && (
        <div className="events-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Leave Event</h3>
              <span className="modal-close" onClick={cancelLeaveEvent}>&times;</span>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to leave this event? You will lose access to its details and updates.</p>
            </div>
            <div className="modal-footer">
              <button className="lb-btn secondary" onClick={cancelLeaveEvent} disabled={isLeaving}>Cancel</button>
              <button className="lb-btn" style={{background: '#d9534f', color: '#fff'}} onClick={confirmLeaveEvent} disabled={isLeaving}>
                {isLeaving ? <span className="spinner-btn"></span> : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsPage;