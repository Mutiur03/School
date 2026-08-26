import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

export interface Holiday {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  description: string;
  is_optional: boolean;
}

export interface HolidayFormData {
  title: string;
  start_date: string;
  end_date: string;
  description: string;
  is_optional: boolean;
}

export const useHolidays = () =>
  useQuery<Holiday[]>({
    queryKey: ['holidays'],
    queryFn: async () => {
      const res = await axios.get('/api/holidays/getHolidays');
      return res.data.data;
    },
  });

export const useAddHoliday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: HolidayFormData) => {
      const response = await axios.post('/api/holidays/addHoliday', formData);
      return response.data.data as Holiday;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday added successfully');
    },
    onError: (error: AxiosError<{ error: string }>) => {
      toast.error(error.response?.data?.error || 'Error adding holiday');
    },
  });
};

export const useUpdateHoliday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: HolidayFormData }) => {
      const response = await axios.put(`/api/holidays/updateHoliday/${id}`, formData);
      return response.data.data as Holiday;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday updated successfully');
    },
    onError: (error: AxiosError<{ error: string }>) => {
      toast.error(error.response?.data?.error || 'Error updating holiday');
    },
  });
};

export const useDeleteHoliday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/holidays/deleteHoliday/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday deleted successfully');
    },
    onError: (error: AxiosError<{ error: string }>) => {
      toast.error(error.response?.data?.error || 'Error deleting holiday');
    },
  });
};
