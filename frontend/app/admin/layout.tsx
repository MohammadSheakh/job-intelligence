import type { ReactNode } from 'react';
import { AdminSession } from '../../lib/admin-api';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminSession>{children}</AdminSession>;
}
