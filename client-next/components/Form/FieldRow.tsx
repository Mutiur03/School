'use client';

import React, { useId } from 'react';

const CONTROL_TYPES = new Set(['input', 'select', 'textarea']);

function isFormControl(
  child: React.ReactElement,
): child is React.ReactElement<React.InputHTMLAttributes<HTMLInputElement> & { id?: string }> {
  return typeof child.type === 'string' && CONTROL_TYPES.has(child.type);
}

const FieldRow: React.FC<{
  label: React.ReactNode;
  isRequired: boolean;
  instruction?: React.ReactNode;
  error: any;
  tooltip?: string;
  htmlFor?: string;
  children: React.ReactNode;
}> = ({ label, isRequired, instruction, error, tooltip, htmlFor, children }) => {
  const autoId = useId();
  const childArray = React.Children.toArray(children);
  const first = childArray[0];
  const firstIsControl = React.isValidElement(first) && isFormControl(first);
  const existingId =
    firstIsControl && typeof first.props.id === 'string' ? first.props.id : undefined;
  const controlId = htmlFor ?? existingId ?? (firstIsControl ? autoId : undefined);

  const enhancedChildren =
    firstIsControl && controlId && !existingId
      ? [React.cloneElement(first, { id: controlId }), ...childArray.slice(1)]
      : children;

  return (
    <div className="flex w-full flex-col items-start gap-1 py-2 lg:flex-row lg:gap-4">
      <div className="mb-1 w-full shrink-0 text-left text-sm font-medium select-none lg:mb-0 lg:w-60">
        <span className="flex items-center gap-1">
          {controlId ? (
            <label htmlFor={controlId} className="cursor-pointer">
              {label}
              {isRequired && (
                <span className="ml-1 text-red-600" aria-hidden="true">
                  *
                </span>
              )}
            </label>
          ) : (
            <span>
              {label}
              {isRequired && (
                <span className="ml-1 text-red-600" aria-hidden="true">
                  *
                </span>
              )}
            </span>
          )}
          {tooltip && (
            <button
              type="button"
              className="group relative inline-flex cursor-pointer border-0 bg-transparent p-0 align-middle"
              aria-label={typeof tooltip === 'string' ? tooltip : 'More information'}
            >
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-400 bg-blue-500 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                aria-hidden="true"
              >
                ?
              </span>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-xs -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-sm text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {tooltip}
              </span>
            </button>
          )}
        </span>
      </div>
      <div className="w-full min-w-0 flex-1">
        {enhancedChildren}
        {instruction && <Instruction>{instruction}</Instruction>}
        {error && (
          <div className="text-sm text-red-600" role="alert">
            {error.message}
          </div>
        )}
      </div>
    </div>
  );
};
export default FieldRow;
const Instruction: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-gray-900">{children}</p>
);
export { Instruction };
