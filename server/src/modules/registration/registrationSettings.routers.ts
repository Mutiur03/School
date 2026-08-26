import {
  class6RegistrationSettingsSchema,
  class8RegistrationSettingsSchema,
  class9RegistrationSettingsSchema,
} from '@school/shared-schemas';
import { makeRegistrationSettingsRouter } from './registrationSettings.route.js';
import {
  class6SettingsConfig,
  class8SettingsConfig,
  class9SettingsConfig,
} from './registrationSettings.service.js';

export const registrationSettingsClass6Router = makeRegistrationSettingsRouter({
  mountPath: '/api/reg/class-6',
  settingsSchema: class6RegistrationSettingsSchema,
  config: class6SettingsConfig,
  updateSuccessMessage: 'Class Six Registration updated successfully',
  fetchSuccessMessage: 'Class Six Registration fetched successfully',
});

export const registrationSettingsClass8Router = makeRegistrationSettingsRouter({
  mountPath: '/api/reg/class-8',
  settingsSchema: class8RegistrationSettingsSchema,
  config: class8SettingsConfig,
  updateSuccessMessage: 'Class Eight Registration updated successfully',
  fetchSuccessMessage: 'Class Eight Registration fetched successfully',
});

export const registrationSettingsClass9Router = makeRegistrationSettingsRouter({
  mountPath: '/api/reg/class-9',
  settingsSchema: class9RegistrationSettingsSchema,
  config: class9SettingsConfig,
  updateSuccessMessage: 'Class 9 Registration updated successfully',
  fetchSuccessMessage: 'Class 9 Registration fetched successfully',
});
