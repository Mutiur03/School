'use client';

import type { Syllabus } from '@/types';
import axios from 'axios';
import { useRef, useState } from 'react';

function useLazyFetch<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const inflight = useRef<Promise<T> | null>(null);

  const refetch = async () => {
    if (inflight.current) {
      return { data: await inflight.current };
    }
    const promise = fetcher().then((value) => {
      setData(value);
      return value;
    });
    inflight.current = promise;
    try {
      return { data: await promise };
    } finally {
      if (inflight.current === promise) inflight.current = null;
    }
  };

  return { data, refetch };
}

export const useRoutinePDF = () =>
  useLazyFetch(async () => {
    const res = await axios.get('/api/class-routine/pdf');
    return (res.data.data?.[0]?.pdf_url as string | null) || null;
  });

export const useSyllabuses = () =>
  useLazyFetch<Syllabus[]>(async () => {
    const res = await axios.get('/api/syllabus');
    return (res.data.data ?? []) as Syllabus[];
  });

export const useCitizenCharter = () =>
  useLazyFetch(async () => {
    const response = await axios.get('/api/citizen-charter');
    return (response.data.file as string | null) || null;
  });
