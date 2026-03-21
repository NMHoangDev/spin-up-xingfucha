import type {Metadata} from 'next';
import './globals.css'; // Global styles
import Providers from '@/components/providers';
import FirebaseInit from '@/components/firebase-init';

export const metadata: Metadata = {
  title: 'XingFuCha Spin & Win',
  description: 'A gamified landing page for XingFuCha beverage brand featuring a spin-the-wheel reward system.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <FirebaseInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
