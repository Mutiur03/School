import { registrationSchema, class6RegistrationStatusSchema } from '@school/shared-schemas';
import { RegistrationFormClass6Service } from './registrationFormClass6.service.js';
import { makeRegistrationFormRouter } from '../../registrationForm.route.js';

export default makeRegistrationFormRouter({
  mountPath: '/api/reg/class-6/form',
  formSchema: registrationSchema,
  statusSchema: class6RegistrationStatusSchema,
  service: RegistrationFormClass6Service,
  excelFilename: 'Class6_Registrations.xlsx',
  photosZipPrefix: 'Class6_Photos',
  yearQueryKeys: ['class6_year'],
  photoField: 'photo',
  pdfFilenamePrefix: 'Class6_Reg',
});
