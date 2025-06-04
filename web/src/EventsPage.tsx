// File: src/EventsPage.tsx
import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { listEvents, getEvent } from './graphql/queries';
import { deleteEvent, joinEvent, createEvent, updateEvent, leaveEvent } from './graphql/mutations';
import { fetchAuthSession } from '@aws-amplify/auth';
import './EventsPage.css';
import { FiEdit2, FiTrash2, FiLogOut } from 'react-icons/fi';

const client = generateClient();

interface Event {
  id: string;
  name: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  inviteCode: string;
  owner: string; // add owner field
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
  
  // Form states for create/edit
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const session = await fetchAuthSession();
        const username = typeof session.tokens?.idToken?.payload['cognito:username'] === 'string' 
          ? session.tokens?.idToken?.payload['cognito:username'] 
          : null;
        setCurrentUser(username);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      
      try {
        const { data } = await client.graphql({
          query: listEvents,
          authMode: 'userPool'
        });
        
        setEvents(
          (data.listEvents.items || []).map((item: any) => ({
            ...item,
            description: item.description ?? undefined,
            location: item.location ?? undefined,
          }))
        );
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [currentUser]);

  const handleJoinEvent = async () => {
    if (!inviteCode.trim()) return;
    
    try {
      await client.graphql({
        query: joinEvent,
        variables: { inviteCode: inviteCode.trim() },
        authMode: 'userPool'
      });
      
      // Refresh events after joining
      const { data } = await client.graphql({ query: listEvents });
      setEvents(
        (data.listEvents.items || []).map((item: any) => ({
          ...item,
          description: item.description ?? undefined,
          location: item.location ?? undefined,
        }))
      );
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
      setEvents(prevEvents => prevEvents.filter(event => event.id !== eventToDelete));
    } catch (error) {
      console.error('Error deleting event:', error);
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
          }
        : null;
      setCurrentEvent(event);
      if (event) {
        setEventName(event.name);
        setEventDescription(event.description || '');
        setEventLocation(event.location || '');
        setEventStartTime(event.startTime.substring(0, 16));
        setEventEndTime(event.endTime.substring(0, 16));
        setShowEditModal(true);
      }
    } catch (error) {
      console.error('Error fetching event for edit:', error);
    }
  };

  const handleCreateEvent = async () => {
    if (!eventName.trim()) return;
    
    try {
      await client.graphql({
        query: createEvent,
        variables: {
          input: {
            name: eventName,
            description: eventDescription || null,
            location: eventLocation || null,
            startTime: new Date(eventStartTime).toISOString(),
            endTime: new Date(eventEndTime).toISOString(),
            liquorbotId: 1, // Replace with actual number value if needed
            inviteCode: Math.random().toString(36).substring(2, 10).toUpperCase(), // Generate a random code or use your logic
            owner: currentUser || '' // Use the current user's username
          }
        },
        authMode: 'userPool'
      });
      
      // Refresh events
      const { data } = await client.graphql({ query: listEvents });
      setEvents(
        (data.listEvents.items || []).map((item: any) => ({
          ...item,
          description: item.description ?? undefined,
          location: item.location ?? undefined,
        }))
      );
      setShowCreateModal(false);
      resetEventForm();
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const handleUpdateEvent = async () => {
    if (!currentEvent || !eventName.trim()) return;
    setIsUpdating(true);
    try {
      await client.graphql({
        query: updateEvent,
        variables: {
          input: {
            id: currentEvent.id,
            name: eventName,
            description: eventDescription || null,
            location: eventLocation || null,
            startTime: new Date(eventStartTime).toISOString(),
            endTime: new Date(eventEndTime).toISOString()
          }
        },
        authMode: 'userPool'
      });

      // Update local state for immediate UI update
      setEvents(prevEvents =>
        prevEvents.map(evt =>
          evt.id === currentEvent.id
            ? {
                ...evt,
                name: eventName,
                description: eventDescription || undefined,
                location: eventLocation || undefined,
                startTime: new Date(eventStartTime).toISOString(),
                endTime: new Date(eventEndTime).toISOString()
              }
            : evt
        )
      );

      resetEventForm();
    } catch (error) {
      console.error('Error updating event:', error);
    } finally {
      setIsUpdating(false);
      setShowEditModal(false);
    }
  };

  const handleLeaveEvent = async (id: string) => {
    try {
      await client.graphql({
        query: leaveEvent,
        variables: { eventId: id },
        authMode: 'userPool'
      });
      setEvents(prev => prev.filter(evt => evt.id !== id));
    } catch (error) {
      console.error('Error leaving event:', error);
    }
  };

  const resetEventForm = () => {
    setEventName('');
    setEventDescription('');
    setEventLocation('');
    setEventStartTime('');
    setEventEndTime('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

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
        <div style={{fontSize: 64, marginBottom: 16, textAlign: 'center'}}>📅</div>
        <h2 style={{marginBottom: 12, textAlign: 'center'}}>You must sign in to view your events</h2>
        <p style={{color: '#cecece', maxWidth: 400, marginBottom: 28, fontSize: 16, textAlign: 'center'}}>
          Sign in to create, join, and manage your events. You'll be able to see your upcoming parties, share invite codes, and keep track of all your cocktail gatherings in one place.
        </p>
        <button
          className="lb-btn"
          onClick={() => {
            // Try to trigger the sign-in modal from the parent App
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
            onClick={() => setShowCreateModal(true)}
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
            <div key={event.id} className="event-card">
              <div className="event-card-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                <h3 className="event-name" style={{marginBottom: 0}}>{event.name}</h3>
                <div className="event-card-actions" style={{display: 'flex', gap: 8}}>
                  {event.owner === currentUser ? (
                    <>
                      <button
                        className="icon-btn"
                        title="Edit Event"
                        onClick={() => openEditModal(event.id)}
                        style={{background: 'none', border: 'none', color: '#ce975e', cursor: 'pointer', padding: 4, borderRadius: 4}}
                      >
                        <FiEdit2 size={20} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Delete Event"
                        onClick={() => handleDeleteEvent(event.id)}
                        style={{background: 'none', border: 'none', color: '#d9534f', cursor: 'pointer', padding: 4, borderRadius: 4}}
                      >
                        <FiTrash2 size={20} />
                      </button>
                    </>
                  ) : (
                    <button
                      className="icon-btn"
                      title="Leave Event"
                      onClick={() => handleLeaveEvent(event.id)}
                      style={{background: 'none', border: 'none', color: '#d9534f', cursor: 'pointer', padding: 4, borderRadius: 4}}
                    >
                      <FiLogOut size={20} />
                    </button>
                  )}
                </div>
              </div>
              {event.location && (
                <p className="event-details">
                  <strong>Location:</strong> {event.location}
                </p>
              )}
              <p className="event-details">
                <strong>Starts:</strong> {formatDate(event.startTime)}
              </p>
              <p className="event-details">
                <strong>Ends:</strong> {formatDate(event.endTime)}
              </p>
              {event.description && (
                <p className="event-details">{event.description}</p>
              )}
              <p className="event-details">
                <strong>Invite Code:</strong> {event.inviteCode}
              </p>
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
          <div className="modal-content">
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
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="datetime-local"
                    className="modal-input"
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="datetime-local"
                    className="modal-input"
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                  />
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
          <div className="modal-content">
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
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="datetime-local"
                    className="modal-input"
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="datetime-local"
                    className="modal-input"
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                  />
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
                disabled={isUpdating}
              >
                {isUpdating ? (<><span className="spinner-btn"></span>Updating...</>) : 'Update Event'}
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
    </div>
  );
};

export default EventsPage;