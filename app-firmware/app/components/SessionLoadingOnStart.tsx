import { useEffect, useContext } from 'react';
import { AuthModalContext } from './AuthModalContext';
import { getCurrentUser } from '@aws-amplify/auth';

export default function SessionLoadingOnStart() {
  const authModal = useContext(AuthModalContext);
  useEffect(() => {
    (async () => {
      try {
        await getCurrentUser();
        // Only open session loading if user is signed in
        if (authModal?.open) {
          authModal.open('sessionLoading', { modalMode: true });
        }
      } catch {
        // No signed-in user: do nothing (or optionally redirect to home/index)
      }
    })();
    // Only run on cold start (mount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
