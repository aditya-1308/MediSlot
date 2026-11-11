import TodayAppointments from './TodayAppointments';
import Schedule from './Schedule';

export default [
  { path: '/doctor', element: <TodayAppointments />, roles: ['DOCTOR'], nav: "Today's list" },
  { path: '/doctor/schedule', element: <Schedule />, roles: ['DOCTOR'], nav: 'Availability & slots' },
];
