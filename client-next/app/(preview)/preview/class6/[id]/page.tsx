'use client';

import { Class6PdfPreview } from '@school/common-ui';
import { use } from 'react';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function Class6PdfPreviewPage({ params }: PageProps) {
  const { id } = use(params);
  return <Class6PdfPreview id={id} />;
}
