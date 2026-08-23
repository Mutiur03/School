'use client';

import { getFileUrl } from '@/lib/cdn';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

interface Exam {
  id: number;
  exam_name: string;
  visible: boolean;
  levels: number[];
  start_date: string;
  routine?: string | null;
  download_url?: string | null;
}

interface ExamRoutineClientProps {
  exams: Exam[];
  initialSelectedId: number | null;
  loadError?: string | null;
}

export default function ExamRoutineClient({
  exams,
  initialSelectedId,
  loadError,
}: ExamRoutineClientProps) {
  const initialSelectedExam = useMemo(() => {
    if (!initialSelectedId) {
      return exams[0] ?? null;
    }
    return exams.find((exam) => exam.id === initialSelectedId) ?? exams[0] ?? null;
  }, [exams, initialSelectedId]);

  const [selectedExam, setSelectedExam] = useState<Exam | null>(initialSelectedExam);
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = Math.max(
      0,
      exams.findIndex((exam) => exam.id === selectedExam?.id),
    );
    optionRefs.current[selectedIndex]?.focus();
  }, [open, exams, selectedExam?.id]);

  const selectExam = (exam: Exam | null) => {
    setSelectedExam(exam);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const moveFocus = (fromIndex: number, delta: number) => {
    if (exams.length === 0) return;
    const next = (fromIndex + delta + exams.length) % exams.length;
    optionRefs.current[next]?.focus();
  };

  return (
    <div className="py-12">
      <div className="container-custom">
        <h1 className="section-title">Exam Routine</h1>
        {loadError ? (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </p>
        ) : null}

        <div className="relative mb-6 max-w-full min-w-0 sm:max-w-md" ref={rootRef}>
          <button
            ref={buttonRef}
            type="button"
            className="border-border bg-background text-foreground focus:ring-primary focus:border-primary flex w-full items-center justify-between gap-3 rounded-xs border px-3 py-2.5 text-left text-base transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-label="Select an exam"
            disabled={exams.length === 0}
            onClick={() => setOpen((prev) => !prev)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setOpen(true);
              }
            }}
          >
            <span className="min-w-0 truncate">{selectedExam?.exam_name ?? 'Select an exam'}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>

          {open ? (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Exams"
              className="border-border bg-background absolute top-full right-0 left-0 z-40 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-xs border shadow-md"
            >
              {exams.map((exam, index) => {
                const selected = selectedExam?.id === exam.id;
                return (
                  <li key={exam.id} role="presentation">
                    <button
                      ref={(el) => {
                        optionRefs.current[index] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`block w-full truncate px-3 py-2.5 text-left text-base transition-colors ${
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted'
                      }`}
                      onClick={() => selectExam(exam)}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          moveFocus(index, 1);
                        } else if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          moveFocus(index, -1);
                        } else if (event.key === 'Home') {
                          event.preventDefault();
                          optionRefs.current[0]?.focus();
                        } else if (event.key === 'End') {
                          event.preventDefault();
                          optionRefs.current[exams.length - 1]?.focus();
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          setOpen(false);
                          buttonRef.current?.focus();
                        }
                      }}
                    >
                      {exam.exam_name}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col items-center">
          {selectedExam?.routine ? (
            <div className="flex w-full justify-center px-0 sm:px-0">
              <div className="border-border flex h-[min(70vh,900px)] min-h-[280px] w-full max-w-[1200px] items-center justify-center overflow-hidden rounded-lg border bg-gray-100 shadow sm:min-h-[420px]">
                <iframe
                  src={getFileUrl(selectedExam.routine)}
                  title="Exam Routine PDF"
                  className="block h-full w-full border-0"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 p-8 text-center">
              <h3 className="text-xl font-medium text-gray-600">Exam Routine</h3>
              <p className="mt-2 text-gray-500">Exam routine will be updated soon.</p>
            </div>
          )}
        </div>
        <div className="mt-8 border-l-4 border-yellow-400 bg-yellow-50 p-4">
          <h3 className="text-lg font-medium text-yellow-800">Note:</h3>
          <ul className="mt-2 space-y-1 text-yellow-700">
            <li>
              • Exam starts at 10 AM. Students must arrive at least 20 minutes before the exam.
            </li>
            <li>• Bring your admit card and necessary stationery.</li>
            <li>• No mobile phones or electronic devices are allowed in the exam hall.</li>
            <li>• Follow all instructions given by the invigilators.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
