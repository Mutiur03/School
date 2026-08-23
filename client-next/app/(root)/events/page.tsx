import { api } from '@/lib/backend';
import EventsClient from './EventsClient';

export const metadata = {
  title: 'Events',
};

type EventItem = {
  id: number;
  title: string;
  date: string;
  location?: string;
  details?: string;
  image?: string;
  pdf?: string;
  pdf_url?: string;
  download_url?: string;
};

export default async function EventsPage() {
  let events: EventItem[] = [];
  let loadError: string | null = null;

  try {
    const res = await api.get<EventItem[]>('/api/events/getEvents', {
      revalidate: 60,
    });
    const payload = res.data;
    events = Array.isArray(payload) ? payload : [];
  } catch {
    loadError = 'Unable to load events right now. Please try again later.';
  }

  return <EventsClient events={events} loadError={loadError} />;
}
