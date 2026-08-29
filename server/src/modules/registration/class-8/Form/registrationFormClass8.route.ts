import {
  registrationSchemaClass8,
  class8RegistrationStatusSchema,
  registrationLookupSchema,
} from '@school/shared-schemas';
import { RegistrationFormClass8Service } from './registrationFormClass8.service.js';
import { makeRegistrationFormRouter } from '../../registrationForm.route.js';

export default makeRegistrationFormRouter({
  mountPath: '/api/reg/class-8/form',
  formSchema: registrationSchemaClass8,
  statusSchema: class8RegistrationStatusSchema,
  lookupSchema: registrationLookupSchema,
  service: RegistrationFormClass8Service,
  excelFilename: 'Class8_Registrations.xlsx',
  photosZipPrefix: 'Class8_Photos',
  yearQueryKeys: ['class8_year'],
  photoField: 'photo',
  pdfFilenamePrefix: 'Class8_Reg',
});
