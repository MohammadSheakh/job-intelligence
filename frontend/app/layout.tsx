import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = { title: 'Job Intelligence', description: 'Admin and candidate job intelligence' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
