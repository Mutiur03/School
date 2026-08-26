import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

type SettingsRecord = {
  id?: number;
  notice?: string | null;
  [key: string]: string | number | boolean | null | undefined;
};

type UseRegistrationSettingsYearOptions = {
  queryKey: string;
  apiPath: string;
  yearParam: string;
  yearField: string;
  extraYearValues?: Array<string | number | null | undefined>;
};

export function useRegistrationSettingsYear({
  queryKey,
  apiPath,
  yearParam,
  yearField,
  extraYearValues = [],
}: UseRegistrationSettingsYearOptions) {
  const currentYear = new Date().getFullYear().toString();
  const [settingsYear, setSettingsYear] = useState(currentYear);
  const [settingsYearTouched, setSettingsYearTouched] = useState(false);

  const normalizedSettingsYear = settingsYear.trim();
  const settingsYearIsValid = /^\d{4}$/.test(normalizedSettingsYear);

  const {
    data: latestSettingsData,
    isLoading: latestSettingsLoading,
    isFetched: latestSettingsFetched,
  } = useQuery({
    queryKey: [queryKey, 'latest'],
    queryFn: async () => {
      const res = await axios.get(apiPath);
      return res.data.success ? (res.data.data as SettingsRecord | null) : null;
    },
  });

  const {
    data: settingsData,
    isLoading: settingsLoading,
    isFetching: settingsFetching,
  } = useQuery({
    queryKey: [queryKey, normalizedSettingsYear],
    queryFn: async () => {
      const res = await axios.get(apiPath, { params: { [yearParam]: normalizedSettingsYear } });
      return res.data.success ? (res.data.data as SettingsRecord | null) : null;
    },
    enabled: settingsYearIsValid && (settingsYearTouched || latestSettingsFetched),
  });

  const settingsExist = Boolean(settingsData?.id);
  const defaultSettingsYear = String(latestSettingsData?.[yearField] || currentYear);

  const settingsYearOptions = useMemo(() => {
    const baseYear = Number(defaultSettingsYear);
    const years = Number.isInteger(baseYear)
      ? Array.from({ length: 6 }, (_, i) => baseYear - i)
      : [];

    for (const value of [settingsYear, ...extraYearValues]) {
      if (value == null || value === '') continue;
      const parsed = Number(value);
      if (Number.isInteger(parsed)) {
        years.push(parsed);
      }
    }

    return [...new Set(years)].sort((a, b) => b - a);
  }, [defaultSettingsYear, extraYearValues, settingsYear]);

  useEffect(() => {
    const latestYear = latestSettingsData?.[yearField];
    if (!settingsYearTouched && latestYear) {
      setSettingsYear(String(latestYear));
    }
  }, [latestSettingsData, settingsYearTouched, yearField]);

  return {
    currentYear,
    settingsYear,
    normalizedSettingsYear,
    settingsYearIsValid,
    latestSettingsData,
    latestSettingsLoading,
    settingsData,
    settingsLoading,
    settingsFetching,
    settingsExist,
    defaultSettingsYear,
    settingsYearOptions,
    onSettingsYearChange: (value: string) => {
      setSettingsYearTouched(true);
      setSettingsYear(value);
    },
    onUseLatestSettingsYear: () => {
      setSettingsYearTouched(false);
      setSettingsYear(defaultSettingsYear);
    },
    settingsYearTouched,
  };
}
