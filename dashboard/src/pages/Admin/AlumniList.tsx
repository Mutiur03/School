import axios from 'axios';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { GraduationCap, Loader2, Search, Users } from 'lucide-react';
import { PageHeader, SectionCard, FilterSelection, FilterField } from '@/components';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

interface Student {
  id: string;
  name: string;
  phone: number;
  roll: number;
  batch: string;
  section: string;
  address: string;
  dob?: string;
}

function AlumniList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const getStudentList = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await axios.get('/api/students/alumni');
        setStudents(response.data.data || []);
      } catch (error) {
        console.error('Error fetching alumni:', error);
        setLoadError('Failed to load alumni list.');
        toast.error('Failed to load alumni list');
      } finally {
        setLoading(false);
      }
    };
    getStudentList();
  }, []);

  const batches = [...new Set(students.map((s) => s.batch))].sort((a, b) => b.localeCompare(a));
  const sections = [...new Set(students.map((s) => s.section))];

  const filteredStudents = students
    .filter(
      (student) =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.phone?.toString().includes(searchQuery),
    )
    .filter((student) => (batchFilter ? student.batch === batchFilter : true))
    .filter((student) => (sectionFilter ? student.section === sectionFilter : true))
    .sort((a, b) => a.batch.localeCompare(b.batch));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Alumni List"
        description="Browse and filter former students by batch, section, or name."
      />

      <FilterSelection>
        <FilterField label="Search" wide>
          <div className="relative">
            <Search size={18} className="text-muted-foreground absolute top-2.5 left-3" />
            <Input
              type="search"
              name="alumni-search"
              placeholder="Search by name or phone…"
              autoComplete="off"
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </FilterField>

        <FilterField label="Batch">
          <Select
            value={batchFilter || '__all__'}
            onValueChange={(v) => setBatchFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-full" aria-label="Filter by batch">
              <SelectValue placeholder="All Batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Batches</SelectItem>
              {batches.map((batch) => (
                <SelectItem key={batch} value={batch}>
                  {batch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Section">
          <Select
            value={sectionFilter || '__all__'}
            onValueChange={(v) => setSectionFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-full" aria-label="Filter by section">
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Sections</SelectItem>
              {sections.map((section) => (
                <SelectItem key={section} value={section}>
                  {section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterSelection>

      <SectionCard
        noPadding
        title="Alumni"
        icon={<GraduationCap size={20} />}
        description={
          loading
            ? undefined
            : `${filteredStudents.length} student${filteredStudents.length === 1 ? '' : 's'}`
        }
      >
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading alumni…
          </div>
        ) : loadError ? (
          <p className="text-destructive px-6 py-8 text-center text-sm">{loadError}</p>
        ) : filteredStudents.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-muted/40 border-border border-b">
                    {['Name', 'Phone', 'Roll', 'Batch', 'Section', 'Address', 'DOB'].map(
                      (header) => (
                        <th
                          key={header}
                          className="text-foreground/70 px-4 py-3 text-xs font-semibold tracking-wider uppercase"
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{student.name}</td>
                      <td className="px-4 py-3">{student.phone ? `0${student.phone}` : '—'}</td>
                      <td className="px-4 py-3 tabular-nums">{student.roll}</td>
                      <td className="px-4 py-3">{student.batch}</td>
                      <td className="px-4 py-3">{student.section}</td>
                      <td className="max-w-xs px-4 py-3 break-words">{student.address}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {student.dob?.slice(0, 10) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-border divide-y lg:hidden">
              {filteredStudents.map((student) => (
                <li key={student.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm font-semibold wrap-break-word">
                      {student.name}
                    </p>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      Roll {student.roll}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Phone</dt>
                      <dd>{student.phone ? `0${student.phone}` : '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Batch</dt>
                      <dd>{student.batch || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Section</dt>
                      <dd>{student.section || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">DOB</dt>
                      <dd>{student.dob?.slice(0, 10) || '—'}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Address</dt>
                      <dd className="wrap-break-word">{student.address || '—'}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-sm">
            <Users className="h-8 w-8 opacity-50" />
            No alumni found.
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default AlumniList;
