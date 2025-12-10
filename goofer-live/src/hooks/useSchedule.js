import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SCHEDULE as DEFAULT_SCHEDULE } from '../constants';

export function useSchedule() {
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Set up real-time listener for schedule
    const docRef = doc(db, 'settings', 'schedule');

    const unsubscribe = onSnapshot(
      docRef,
      (doc) => {
        if (doc.exists()) {
          setSchedule(doc.data().schedule || DEFAULT_SCHEDULE);
        } else {
          setSchedule(DEFAULT_SCHEDULE);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching schedule:', err);
        setError(err);
        setSchedule(DEFAULT_SCHEDULE); // Fallback to default
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { schedule, loading, error };
}
