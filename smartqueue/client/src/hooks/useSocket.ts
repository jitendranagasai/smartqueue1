import { useEffect } from 'react';
import { socketService } from '../services/socket.service';

export function useSocket(event: string, handler: (data: any) => void) {
  useEffect(() => {
    const unsubscribe = socketService.on(event, handler);
    return () => {
      unsubscribe();
    };
  }, [event, handler]);
}
