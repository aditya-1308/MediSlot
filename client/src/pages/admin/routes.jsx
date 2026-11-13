import Dashboard from './Dashboard';
import Specialties from './Specialties';
import Medicines from './Medicines';
import Reports from './Reports';

export default [
  { path: '/admin', element: <Dashboard />, roles: ['ADMIN'], nav: 'Admin' },
  { path: '/admin/specialties', element: <Specialties />, roles: ['ADMIN'] },
  { path: '/admin/medicines', element: <Medicines />, roles: ['ADMIN'] },
  { path: '/admin/reports', element: <Reports />, roles: ['ADMIN'] },
];
