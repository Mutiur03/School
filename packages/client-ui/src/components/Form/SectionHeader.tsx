const SectionHeader: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <fieldset className="border border-gray-300 rounded-sm p-4 sm:p-6">
        <legend>
            <strong>{title}</strong>
        </legend>
        {children}
    </fieldset>
);
export default SectionHeader;