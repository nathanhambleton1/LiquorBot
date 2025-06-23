import { useEffect, useContext } from 'react';
import { AuthModalContext } from './AuthModalContext';

export default function SessionLoadingOnStart() {
  const authModal = useContext(AuthModalContext);
  useEffect(() => {
    if (authModal?.open) {
      authModal.open('sessionLoading', { modalMode: true });
    }
    // Only run on cold start (mount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
