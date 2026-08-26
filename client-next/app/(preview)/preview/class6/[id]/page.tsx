'use client';

import { RegistrationPdfPreview } from '@school/common-ui';
import { use } from 'react';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function Class6PdfPreviewPage({ params }: PageProps) {
  const { id } = use(params);
  return <RegistrationPdfPreview classSlug="class-6" id={id} />;
}
