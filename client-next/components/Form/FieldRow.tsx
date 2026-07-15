"use client";

import React, { useId } from "react";

const CONTROL_TYPES = new Set(["input", "select", "textarea"]);

function isFormControl(
    child: React.ReactElement,
): child is React.ReactElement<React.InputHTMLAttributes<HTMLInputElement> & { id?: string }> {
    return typeof child.type === "string" && CONTROL_TYPES.has(child.type);
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
        firstIsControl && typeof first.props.id === "string" ? first.props.id : undefined;
    const controlId = htmlFor ?? existingId ?? (firstIsControl ? autoId : undefined);

    const enhancedChildren = firstIsControl && controlId && !existingId
        ? [
              React.cloneElement(first, { id: controlId }),
              ...childArray.slice(1),
          ]
        : children;

    return (
        <div className="flex flex-col lg:flex-row items-start gap-1 lg:gap-4 py-2 w-full">
            <div className="w-full lg:w-60 text-left text-sm font-medium select-none mb-1 lg:mb-0 shrink-0">
                <span className="flex items-center gap-1">
                    {controlId ? (
                        <label htmlFor={controlId} className="cursor-pointer">
                            {label}
                            {isRequired && (
                                <span className="text-red-600 ml-1" aria-hidden="true">
                                    *
                                </span>
                            )}
                        </label>
                    ) : (
                        <span>
                            {label}
                            {isRequired && (
                                <span className="text-red-600 ml-1" aria-hidden="true">
                                    *
                                </span>
                            )}
                        </span>
                    )}
                    {tooltip && (
                        <button
                            type="button"
                            className="cursor-pointer group relative inline-flex align-middle border-0 bg-transparent p-0"
                            aria-label={typeof tooltip === "string" ? tooltip : "More information"}
                        >
                            <span
                                className="w-4 h-4 bg-blue-500 border border-blue-400 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-blue-700 transition-colors"
                                aria-hidden="true"
                            >
                                ?
                            </span>
                            <span
                                role="tooltip"
                                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-xs px-2 py-1 rounded bg-gray-800 text-white text-sm opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 pointer-events-none z-20 transition-opacity duration-200"
                            >
                                {tooltip}
                            </span>
                        </button>
                    )}
                </span>
            </div>
            <div className="flex-1 w-full min-w-0">
                {enhancedChildren}
                {instruction && <Instruction>{instruction}</Instruction>}
                {error && (
                    <div className="text-red-600 text-sm" role="alert">
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
