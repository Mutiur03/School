import {
  registrationSchemaJuniorScholarship,
  juniorScholarshipRegistrationStatusSchema,
  registrationLookupSchema,
} from '@school/shared-schemas';
import { RegistrationFormJuniorScholarshipService } from './registrationFormJuniorScholarship.service.js';
import { makeRegistrationFormRouter } from '../../registrationForm.route.js';

export default makeRegistrationFormRouter({
  mountPath: '/api/reg/junior-scholarship/form',
  formSchema: registrationSchemaJuniorScholarship,
  statusSchema: juniorScholarshipRegistrationStatusSchema,
  lookupSchema: registrationLookupSchema,
  service: RegistrationFormJuniorScholarshipService,
  excelFilename: 'JuniorScholarship_Registrations.xlsx',
  photosZipPrefix: 'JuniorScholarship_Photos',
  yearQueryKeys: ['jse_year'],
  photoField: 'photo',
  pdfFilenamePrefix: 'JuniorScholarship_Form',
});
