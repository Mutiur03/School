'use client';

import { Class8PdfPreview } from '@school/common-ui';
import { use } from 'react';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function Class8PdfPreviewPage({ params }: PageProps) {
  const { id } = use(params);
  return <Class8PdfPreview id={id} />;
}
