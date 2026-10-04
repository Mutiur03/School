import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { Staff } from '@/types/staff';

// No page/limit/search params → the API returns every staff row; the page filters client-side.
export const useStaff = () =>
  useQuery({
    queryKey: ['staff'],
    queryFn: async (): Promise<Staff[]> => {
      const response = await axios.get('/api/staffs');
      return response.data.data;
    },
  });
