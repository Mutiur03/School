import { getFileUrl } from '@/lib/backend';
import Image from 'next/image';

export type PersonListItem = {
  id: number;
  name: string;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  image?: string | null;
};

type PeopleListPageProps = {
  title: string;
  emptyLabel: string;
  nameColumnLabel: string;
  people: PersonListItem[];
  /** Teacher list always shows Email; staff only when present. */
  showEmailAlways?: boolean;
};

export function PeopleListPage({
  title,
  emptyLabel,
  nameColumnLabel,
  people,
  showEmailAlways = false,
}: PeopleListPageProps) {
  return (
    <div className="p-4 text-gray-800 sm:p-6 lg:p-8">
      <h1 className="mb-4 text-center font-serif text-2xl sm:mb-6 sm:text-3xl">{title}</h1>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200">
          <thead className="bg-gray-50">
            <tr className="divide-x divide-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                Image
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                {nameColumnLabel}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                Contact Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {people.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-600">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              people.map((person, i) => (
                <tr
                  key={person.id}
                  className={
                    i % 2 === 0
                      ? 'divide-x divide-gray-200 bg-white'
                      : 'divide-x divide-gray-200 bg-gray-50'
                  }
                >
                  <td className="px-4 py-3 align-top text-sm">
                    {person.image ? (
                      <Image
                        src={getFileUrl(person.image) || '/placeholder.svg'}
                        alt={person.name}
                        width={240}
                        height={240}
                        className="h-60 w-60 rounded border border-gray-200 object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded border border-gray-200 bg-gray-100 text-xs text-gray-400">
                        No Image
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top font-serif text-sm tracking-wide">
                    <div className="text-lg font-semibold">{person.name}</div>
                    {person.designation && (
                      <div className="mt-1 text-sm text-gray-600">
                        Designation: {person.designation}
                      </div>
                    )}
                    {(showEmailAlways || person.email) && (
                      <div className="mt-2">
                        <span className="font-medium text-gray-600">Email:</span>{' '}
                        {person.email || '—'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-sm">
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium text-gray-600">Phone:</span>{' '}
                        {person.phone || '—'}
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Address:</span>{' '}
                        {person.address || '—'}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden">
        {people.length === 0 ? (
          <div className="py-8 text-center text-gray-600">{emptyLabel}</div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {people.map((person) => (
              <div
                key={person.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
              >
                <div className="flex flex-col space-y-4 sm:flex-row sm:items-start sm:space-y-0 sm:space-x-4">
                  <div className="shrink-0 self-center sm:self-start">
                    {person.image ? (
                      <Image
                        src={getFileUrl(person.image) || '/placeholder.svg'}
                        alt={person.name}
                        width={96}
                        height={96}
                        className="h-20 w-20 rounded border border-gray-200 object-cover sm:h-24 sm:w-24"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded border border-gray-200 bg-gray-100 text-xs text-gray-400 sm:h-24 sm:w-24">
                        No Image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-3">
                      <h3 className="font-serif text-lg font-semibold tracking-wide wrap-break-word text-gray-900 sm:text-xl">
                        {person.name}
                      </h3>
                      {person.designation && (
                        <p className="mt-1 text-sm text-gray-600">{person.designation}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      <div>
                        <span className="mb-1 block text-xs font-medium tracking-wider text-gray-500">
                          Email
                        </span>
                        <p className="text-sm break-all text-gray-900">{person.email || '—'}</p>
                      </div>

                      <div>
                        <span className="mb-1 block text-xs font-medium tracking-wider text-gray-500">
                          Phone
                        </span>
                        <p className="text-sm text-gray-900">{person.phone || '—'}</p>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="mb-1 block text-xs font-medium tracking-wider text-gray-500">
                          Address
                        </span>
                        <p className="text-sm wrap-break-word text-gray-900">
                          {person.address || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
