import { redirect } from 'next/navigation';

/**
 * There is no marketing surface here — the root just hands over to the overview,
 * whose layout bounces to /login if there is no session.
 */
export default function RootPage(): never {
  redirect('/dashboard');
}
