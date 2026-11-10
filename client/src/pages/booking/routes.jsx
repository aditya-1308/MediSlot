import BookSlot from './BookSlot';
import MyAppointments from './MyAppointments';

// /book/:slotId is the hand-off target from Avinash's free-slot list
export default [
  { path: '/appointments', element: <MyAppointments />, roles: ['PATIENT'], nav: 'My appointments' },
  { path: '/book/:slotId', element: <BookSlot />, roles: ['PATIENT'] },
];
