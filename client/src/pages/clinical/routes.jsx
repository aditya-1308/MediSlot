// MediSlot | Suryanath A | client/src/pages/clinical/routes.jsx
import Prescription from './Prescription';

export default [
  { path: '/visits/:apptId/prescription', element: <Prescription />, roles: ['DOCTOR', 'PATIENT'] },
];
