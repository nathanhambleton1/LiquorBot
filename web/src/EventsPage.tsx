// File: src/EventsPage.tsx
import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { listEvents } from './graphql/queries';
import { deleteEvent, joinEvent } from './graphql/mutations';
import { fetchAuthSession } from '@aws-amplify/auth';
import './EventsPage.css';

const client = generateClient();

interface Event {
  id: string;
  name: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  inviteCode: string;
}

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [currentUser, setCurrentUser] = useState<string | null>(null);

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
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    
    try {
      await client.graphql({
        query: deleteEvent,
        variables: { input: { id } },
        authMode: 'userPool'
      });
      
      setEvents(events.filter(event => event.id !== id));
    } catch (error) {
      console.error('Error deleting event:', error);
    }
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

  // Only show empty state if not loading and events.length === 0
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
            onClick={() => window.location.href = '/create-event'}
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
              <h3 className="event-name">{event.name}</h3>
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
              <div className="event-actions">
                <button 
                  className="lb-btn secondary"
                  onClick={() => {
                    // Navigate to edit page
                    window.location.href = `/create-event?edit=${event.id}`;
                  }}
                >
                  Edit
                </button>
                <button 
                  className="lb-btn secondary"
                  onClick={() => handleDeleteEvent(event.id)}
                >
                  Delete
                </button>
              </div>
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
    </div>
  );
};

export default EventsPage;