'use client';

import { Class9PdfPreview } from '@school/common-ui';
import { use } from 'react';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function Class9PdfPreviewPage({ params }: PageProps) {
  const { id } = use(params);
  return <Class9PdfPreview id={id} />;
}
