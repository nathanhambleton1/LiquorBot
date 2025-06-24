import { useEffect, useContext } from 'react';
import { AuthModalContext } from './AuthModalContext';
import { getCurrentUser } from '@aws-amplify/auth';

export default function SessionLoadingOnStart() {
  const authModal = useContext(AuthModalContext);
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        // Only open session loading if user is signed in
        if (authModal?.open) {
          authModal.open('sessionLoading', { modalMode: true, username: user?.username });
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
