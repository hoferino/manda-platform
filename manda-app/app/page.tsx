/**
 * Root Page - Redirects to Projects
 * Authenticated users go to /projects
 * Unauthenticated users are redirected to /login by middleware
 */

import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/projects')
}
