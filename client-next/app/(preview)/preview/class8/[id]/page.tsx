'use client';

import { RegistrationPdfPreview } from '@school/common-ui';
import { use } from 'react';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function Class8PdfPreviewPage({ params }: PageProps) {
  const { id } = use(params);
  return <RegistrationPdfPreview classSlug="class-8" id={id} />;
}
