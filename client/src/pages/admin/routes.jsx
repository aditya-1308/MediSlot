// MediSlot | client/src/pages/admin/routes.jsx
import AdminDashboard from './AdminDashboard';
import DoctorsAdmin from './DoctorsAdmin';
import SlotsAdmin from './SlotsAdmin';
import AppointmentsAdmin from './AppointmentsAdmin';
import SpecialtiesAdmin from './SpecialtiesAdmin';
import MedicinesAdmin from './MedicinesAdmin';

export default [
  { path: '/admin', element: <AdminDashboard />, roles: ['ADMIN'], nav: 'Dashboard' },
  { path: '/admin/doctors', element: <DoctorsAdmin />, roles: ['ADMIN'], nav: 'Doctors' },
  { path: '/admin/slots', element: <SlotsAdmin />, roles: ['ADMIN'], nav: 'Slots' },
  { path: '/admin/appointments', element: <AppointmentsAdmin />, roles: ['ADMIN'], nav: 'Appointments' },
  { path: '/admin/specialties', element: <SpecialtiesAdmin />, roles: ['ADMIN'], nav: 'Specialties' },
  { path: '/admin/medicines', element: <MedicinesAdmin />, roles: ['ADMIN'], nav: 'Medicines' },
];