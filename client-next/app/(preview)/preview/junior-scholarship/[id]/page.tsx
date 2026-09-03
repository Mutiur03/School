'use client';

import { RegistrationPdfPreview } from '@school/common-ui';
import { use } from 'react';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function JuniorScholarshipPdfPreviewPage({ params }: PageProps) {
  const { id } = use(params);
  return <RegistrationPdfPreview classSlug="junior-scholarship" id={id} />;
}
