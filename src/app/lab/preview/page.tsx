import { notFound } from 'next/navigation';
import PreviewLab from './PreviewLab';

export const metadata = { title: 'Preview lab (dev)', robots: { index: false, follow: false } };

/** Rota interna de produção de assets de preview. Só existe em desenvolvimento. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <PreviewLab />;
}
