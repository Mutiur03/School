import { registrationSchemaClass9, class9RegistrationStatusSchema } from '@school/shared-schemas';
import { RegistrationFormClass9Service } from './registrationFormClass9.service.js';
import { makeRegistrationFormRouter } from '../../registrationForm.route.js';

export default makeRegistrationFormRouter({
  mountPath: '/api/reg/class-9/form',
  formSchema: registrationSchemaClass9,
  statusSchema: class9RegistrationStatusSchema,
  service: RegistrationFormClass9Service,
  excelFilename: 'Class9_Registrations.xlsx',
  photosZipPrefix: 'Class_9_Photos',
  yearQueryKeys: ['ssc_batch', 'ssc_year', 'class9_year'],
  photoField: 'photo_path',
  pdfFilenamePrefix: 'Class9_Reg',
});
