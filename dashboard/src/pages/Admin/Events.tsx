import React, { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import DeleteConfirmation from '@/components/DeleteConfimation';
import { formatDay } from '@/lib/utils';
import { getFileUrl } from '@/lib/backend';
import { Calendar } from 'lucide-react';
import { PageHeader, SectionCard } from '@/components';
import {
  useEvents,
  useAddEvent,
  useUpdateEvent,
  useDeleteEvent,
  type Event,
} from '@/queries/events.queries';

interface FormValues {
  title: string;
  details: string;
  location: string;
  file: File | null | string;
  image: File | null | string;
  date: string | null;
}

interface PopupState {
  visible: boolean;
  type: string;
  event: Event | null;
}

const Events: React.FC = () => {
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: '',
    event: null,
  });
  const [showForm, setShowForm] = useState<boolean>(false);
  const fileref = useRef<HTMLInputElement>(null);
  const imageref = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | number | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({
    title: '',
    details: '',
    location: '',
    file: null,
    image: null,
    date: null,
  });
  const [dateError, setDateError] = useState<string | null>(null);

  const { data: events = [], isLoading } = useEvents();
  const addMutation = useAddEvent();
  const updateMutation = useUpdateEvent();
  const deleteMutation = useDeleteEvent();

  const submitting = addMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    if (!formValues.date) {
      setDateError('Event date is required.');
      toast.error('Please select event date.');
      return;
    }
    setDateError(null);

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: editId!,
          data: {
            title: formValues.title,
            details: formValues.details,
            location: formValues.location,
            date: formValues.date,
            image: formValues.image instanceof File ? formValues.image : undefined,
            file: formValues.file instanceof File ? formValues.file : undefined,
          },
        });
      } else {
        await addMutation.mutateAsync({
          title: formValues.title,
          details: formValues.details,
          location: formValues.location,
          date: formValues.date,
          image: formValues.image instanceof File ? formValues.image : undefined,
          file: formValues.file instanceof File ? formValues.file : undefined,
        });
      }
      handleCancel();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = () => {
    setFormValues({
      title: '',
      details: '',
      location: '',
      file: null,
      image: null,
      date: null,
    });
    if (fileref.current) fileref.current.value = '';
    if (imageref.current) imageref.current.value = '';
    setIsEditing(false);
    setEditId(null);
    setShowForm(false);
  };

  const openPopup = (type: string, event: Event) => {
    setPopup({ visible: true, type, event });
  };

  const closePopup = () => {
    setPopup({ visible: false, type: '', event: null });
  };

  const handleDelete = async (id: string | number) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Error deleting event:', error);
    }
    closePopup();
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Events" description="Create and manage school events.">
        {!showForm && (
          <Button type="button" onClick={() => setShowForm((prev) => !prev)}>
            + Create Event
          </Button>
        )}
      </PageHeader>

      {(showForm || isEditing) && (
        <SectionCard
          title={isEditing ? 'Edit Event' : 'Upload Event'}
          icon={<Calendar size={20} />}
          className="mb-6"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="title">
                Event Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                placeholder="Enter event title"
                value={formValues.title}
                onChange={(e) => setFormValues({ ...formValues, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="details">
                Event Details <span className="font-normal text-gray-400">(Optional)</span>
              </Label>
              <Textarea
                id="details"
                name="details"
                placeholder="Enter detailed event text"
                maxLength={100}
                value={formValues.details}
                onChange={(e) => setFormValues({ ...formValues, details: e.target.value })}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="file">
                  Upload PDF Notice <span className="font-normal text-gray-400">(Optional)</span>
                </Label>
                <Input
                  id="file"
                  type="file"
                  name="file"
                  accept=".pdf"
                  ref={fileref}
                  onChange={(e) =>
                    setFormValues({
                      ...formValues,
                      file: e.target.files?.[0] || null,
                    })
                  }
                />
                {formValues.file && (
                  <p className="text-muted-foreground text-sm">
                    {formValues.file instanceof File
                      ? 'Selected file: ' + formValues.file.name.slice(0, 20) + '...'
                      : 'Uploaded file: ' + (formValues.file as string).slice(0, 20) + '...'}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="image">
                  Upload Photo <span className="font-normal text-gray-400">(Optional)</span>
                </Label>
                <Input
                  id="image"
                  type="file"
                  name="image"
                  accept="image/*"
                  ref={imageref}
                  onChange={(e) =>
                    setFormValues({
                      ...formValues,
                      image: e.target.files?.[0] || null,
                    })
                  }
                />
                {formValues.image && (
                  <p className="text-muted-foreground text-sm">
                    {formValues.image instanceof File
                      ? 'Selected file: ' + formValues.image.name.slice(0, 20) + '...'
                      : 'Uploaded file: ' + (formValues.image as string).slice(0, 20) + '...'}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="date">
                  Event Date <span className="text-red-500">*</span>
                </Label>
                <input
                  id="date"
                  type="date"
                  name="date"
                  required
                  value={(() => {
                    const d = formValues.date;
                    if (!d) return '';
                    // DB stores as MM-DD-YYYY (from en-US toLocaleDateString)
                    const mmddyyyy = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
                    if (mmddyyyy) return `${mmddyyyy[3]}-${mmddyyyy[1]}-${mmddyyyy[2]}`;
                    // ISO format fallback
                    return d.slice(0, 10);
                  })()}
                  onChange={(e) => {
                    setFormValues({ ...formValues, date: e.target.value || null });
                    setDateError(null);
                  }}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                />
                {dateError && <p className="text-sm text-red-500">{dateError}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="location">
                  Event Location <span className="font-normal text-gray-400">(Optional)</span>
                </Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="Enter event location"
                  value={formValues.location}
                  onChange={(e) =>
                    setFormValues({
                      ...formValues,
                      location: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex justify-between gap-4">
              <Button variant="outline" type="button" onClick={handleCancel}>
                {isEditing ? 'Cancel Update' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={submitting} className="">
                {submitting
                  ? isEditing
                    ? 'Updating...'
                    : 'Creating...'
                  : isEditing
                    ? 'Update Event'
                    : 'Create Event'}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="bg-card border-border animate-pulse overflow-hidden rounded-xl border text-center shadow-sm"
            >
              <div className="relative h-40 bg-gray-300"></div>
              <div className="p-4">
                <div className="mb-2 h-4 rounded bg-gray-300"></div>
                <div className="mx-auto h-3 w-1/2 rounded bg-gray-300"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {events.length > 0 ? (
            events.map((event) => (
              <div
                key={event.id}
                className="bg-card border-border overflow-hidden rounded-xl border text-center shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative h-40">
                  <img
                    src={getFileUrl(event.image) || '/placeholder.svg'}
                    alt={event.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="mb-1 text-lg font-semibold">{event.title}</h3>
                  <p className="text-muted-foreground mb-2 text-sm">
                    {formatDay(new Date(event.date))}
                  </p>
                  <button
                    className="text-primary text-sm hover:underline"
                    onClick={() => openPopup('view', event)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground col-span-full text-center">
              No events available.
            </div>
          )}
        </div>
      )}
      {popup.visible && popup.event && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-2xl">
          <div className="bg-card max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg p-6 shadow-lg">
            {popup.type === 'view' && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Event Details</h2>
                  <button onClick={closePopup} className="text-gray-500 hover:text-gray-700">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-center rounded-lg bg-gray-100 p-4">
                    <img
                      src={getFileUrl(popup.event.image) || '/placeholder.svg'}
                      alt=""
                      className="max-h-64 max-w-full rounded-md object-contain shadow-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <strong className="text-gray-700">Title:</strong>
                      <p className="mt-1">{popup.event.title}</p>
                    </div>
                    {popup.event.details && (
                      <div>
                        <strong className="text-gray-700">Details:</strong>
                        <p className="mt-1 text-gray-600 italic">"{popup.event.details}"</p>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <div>
                        <strong className="text-gray-700">Date:</strong>
                        <p className="mt-1">{formatDay(new Date(popup.event.date))}</p>
                      </div>
                      {popup.event.location && (
                        <div className="text-right">
                          <strong className="text-gray-700">Location:</strong>
                          <p className="mt-1">{popup.event.location}</p>
                        </div>
                      )}
                    </div>
                    {popup.event.file && (
                      <div>
                        <strong className="text-gray-700">Notice:</strong>
                        <div className="mt-2 text-center">
                          <a
                            href={getFileUrl(popup.event.file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            View PDF Document
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex justify-between border-t pt-6">
                  <div className="flex gap-3">
                    <DeleteConfirmation
                      onDelete={() => popup.event && handleDelete(popup.event.id)}
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (popup.event) {
                          setFormValues({
                            title: popup.event.title,
                            details: popup.event.details || '',
                            file: popup.event.file,
                            image: popup.event.image,
                            date: popup.event.date,
                            location: popup.event.location || '',
                          });
                          setIsEditing(true);
                          setEditId(popup.event.id);
                          setShowForm(true);
                          closePopup();
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                    >
                      Edit Event
                    </Button>
                  </div>
                  <Button variant="outline" onClick={closePopup}>
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
