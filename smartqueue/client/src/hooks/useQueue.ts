import { useState, useEffect, useCallback } from 'react';
import { queueService, Ticket } from '../services/queue.service';
import { socketService } from '../services/socket.service';

export function useQueue() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await queueService.getMyTickets();
      setTickets(data);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();

    const unsubCreated = socketService.on('ticket:created', () => fetchTickets());
    const unsubCalled = socketService.on('ticket:called', () => fetchTickets());
    const unsubRecalled = socketService.on('ticket:recalled', () => fetchTickets());
    const unsubSkipped = socketService.on('ticket:skipped', () => fetchTickets());
    const unsubCompleted = socketService.on('ticket:completed', () => fetchTickets());
    const unsubCancelled = socketService.on('ticket:cancelled', () => fetchTickets());
    const unsubQueueUpdated = socketService.on('queue:updated', () => fetchTickets());

    return () => {
      unsubCreated();
      unsubCalled();
      unsubRecalled();
      unsubSkipped();
      unsubCompleted();
      unsubCancelled();
      unsubQueueUpdated();
    };
  }, [fetchTickets]);

  const join = async (orgId: string, serviceId: string) => {
    const res = await queueService.joinQueue(orgId, serviceId);
    await fetchTickets();
    return res;
  };

  const cancel = async (ticketId: string) => {
    const res = await queueService.cancelTicket(ticketId);
    await fetchTickets();
    return res;
  };

  return {
    tickets,
    loading,
    refresh: fetchTickets,
    join,
    cancel
  };
}
