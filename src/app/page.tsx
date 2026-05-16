import { redirect } from 'next/navigation';

export default function Home() {
  // Enforce authentication at the root level by redirecting to login
  redirect('/login');
}
