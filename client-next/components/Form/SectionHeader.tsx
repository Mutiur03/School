const SectionHeader: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <fieldset className="rounded-sm border border-gray-300 p-4 sm:p-6">
    <legend>
      <strong>{title}</strong>
    </legend>
    {children}
  </fieldset>
);
export default SectionHeader;
