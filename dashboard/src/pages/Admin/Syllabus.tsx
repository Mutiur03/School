import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BookOpen, Eye, Download, Pencil, Trash2, Loader2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { PageHeader, SectionCard, FilterSelection, FilterField } from '@/components';
import { uploadToR2 } from '@/lib/uploadToR2';
import { getFileUrl } from '@/lib/backend';

interface Syllabus {
  id: number;
  class: string;
  year: string;
  pdf_url: string;
  download_url: string;
}

interface SyllabusForm {
  class: string;
  year: string;
  pdf: File | null;
}

function Syllabus() {
  const currentYear = new Date().getFullYear();
  const [syllabuses, setSyllabuses] = useState<Syllabus[]>([]);
  const [form, setForm] = useState<SyllabusForm>({
    class: '',
    year: String(currentYear),
    pdf: null,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isFormVisible, setIsFormVisible] = useState<boolean>(false);
  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSyllabuses();
  }, []);

  const fetchSyllabuses = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/syllabus');
      setSyllabuses(res.data.data);
    } catch {
      setError('Failed to fetch syllabuses.');
    }
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value, files } = e.target;
    setForm((f) => ({
      ...f,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setProgress(0);
    if (editingId) setUpdating(true);
    else setUploading(true);

    try {
      let key: string | undefined;
      if (form.pdf) {
        key = await uploadToR2('/api/syllabus/presigned-url', form.pdf, setProgress);
      }

      if (editingId) {
        await axios.put(`/api/syllabus/${editingId}`, {
          class: form.class,
          year: form.year,
          ...(key ? { key } : {}),
        });
        setEditingId(null);
      } else {
        if (!key) {
          setError('Please select a PDF file.');
          setUploading(false);
          return;
        }
        await axios.post('/api/syllabus/upload', {
          class: form.class,
          year: form.year,
          key,
        });
      }
      setForm({ class: '', year: String(currentYear), pdf: null });
      setIsFormVisible(false);
      fetchSyllabuses();
    } catch {
      setError('Failed to upload/update syllabus.');
    }
    setUploading(false);
    setUpdating(false);
    setProgress(0);
  };

  const handleEdit = (s: Syllabus): void => {
    setEditingId(s.id);
    setForm({
      class: s.class,
      year: s.year,
      pdf: null,
    });
    setIsFormVisible(true);
  };

  const handleDelete = async (id: number): Promise<void> => {
    setDeletingId(id);
    setError(null);
    try {
      await axios.delete(`/api/syllabus/${id}`);
      fetchSyllabuses();
    } catch {
      setError('Failed to delete syllabus.');
    }
    setDeletingId(null);
  };

  const handleCancelEdit = (): void => {
    setEditingId(null);
    setForm({ class: '', year: String(currentYear), pdf: null });
    setIsFormVisible(false);
  };

  const limitedYears = [String(currentYear - 1), String(currentYear), String(currentYear + 1)];

  const filteredSyllabuses = syllabuses.filter((s) => String(s.year) === String(yearFilter));

  const actionButtons = (s: Syllabus) => (
    <div className="flex flex-wrap gap-2">
      <a
        href={getFileUrl(s.pdf_url)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary flex items-center rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs hover:bg-blue-100"
        title="View"
      >
        <Eye className="h-4 w-4" />
      </a>
      <a
        href={getFileUrl(s.download_url)}
        download
        className="text-primary flex items-center rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs hover:bg-blue-100"
        title="Download"
      >
        <Download className="h-4 w-4" />
      </a>
      <button
        type="button"
        onClick={() => handleEdit(s)}
        className="text-primary flex items-center rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs hover:bg-blue-100"
        title="Edit"
        disabled={uploading || updating || Boolean(deletingId)}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => handleDelete(s.id)}
        className={`flex items-center rounded border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 ${
          deletingId === s.id ? 'pointer-events-none opacity-50' : ''
        }`}
        title="Delete"
        disabled={deletingId === s.id || uploading || updating}
      >
        {deletingId === s.id ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Syllabus Management"
        description="Upload and manage class syllabus PDFs by year."
      >
        {!isFormVisible && (
          <Button
            type="button"
            onClick={() => setIsFormVisible(true)}
            disabled={uploading || updating}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Syllabus
          </Button>
        )}
      </PageHeader>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {isFormVisible && (
        <SectionCard
          title={editingId ? 'Edit Syllabus' : 'Upload Syllabus PDF'}
          icon={<BookOpen size={20} />}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Class</label>
                <Select
                  name="class"
                  value={String(form.class)}
                  onValueChange={(val) => setForm((f) => ({ ...f, class: val }))}
                  disabled={uploading || updating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {[6, 7, 8, 9, 10].map((cls) => (
                      <SelectItem key={cls} value={String(cls)}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Year</label>
                <Select
                  name="year"
                  value={String(form.year)}
                  onValueChange={(val) => setForm((f) => ({ ...f, year: val }))}
                  disabled={uploading || updating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {limitedYears.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">PDF File</label>
              <Input
                name="pdf"
                type="file"
                accept="application/pdf"
                onChange={handleChange}
                disabled={uploading || updating}
                className="text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              {editingId &&
                syllabuses.length > 0 &&
                (() => {
                  const editingSyllabus = syllabuses.find((s) => s.id === editingId);
                  if (editingSyllabus && editingSyllabus.pdf_url) {
                    return (
                      <div className="text-muted-foreground mt-1 text-xs">
                        Current file:{' '}
                        <span className="font-medium">
                          {editingSyllabus.pdf_url.split('/').pop()}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
            </div>
            <div className="flex flex-col justify-end gap-2 pt-2 sm:flex-row sm:space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={uploading || updating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={uploading || updating}>
                {(uploading || updating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId
                  ? updating
                    ? `Uploading ${progress}%...`
                    : 'Update'
                  : uploading
                    ? `Uploading ${progress}%...`
                    : 'Upload'}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      <FilterSelection>
        <FilterField label="Year">
          <Select value={String(yearFilter)} onValueChange={setYearFilter} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {limitedYears.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterSelection>

      <SectionCard noPadding title="Syllabus List" icon={<BookOpen size={20} />}>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[400px] table-fixed divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="w-1/4 px-3 py-3 text-center text-xs font-medium tracking-wider uppercase sm:px-6">
                  Class
                </th>
                <th className="w-1/4 px-3 py-3 text-center text-xs font-medium tracking-wider uppercase sm:px-6">
                  Year
                </th>
                <th className="w-2/4 px-3 py-3 text-center text-xs font-medium tracking-wider uppercase sm:px-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : filteredSyllabuses.length > 0 ? (
                filteredSyllabuses.map((s) => (
                  <tr key={s.id}>
                    <td className="w-1/4 px-3 py-4 text-center sm:px-6">{s.class}</td>
                    <td className="w-1/4 px-3 py-4 text-center sm:px-6">{s.year}</td>
                    <td className="w-2/4 px-3 py-4">
                      <div className="flex justify-center">{actionButtons(s)}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="text-muted-foreground px-6 py-4 text-center" colSpan={3}>
                    No syllabuses found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredSyllabuses.length > 0 ? (
            <ul className="divide-border divide-y">
              {filteredSyllabuses.map((s) => (
                <li key={s.id} className="space-y-3 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Class</span>
                    <span className="font-medium">{s.class}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Year</span>
                    <span className="font-medium">{s.year}</span>
                  </div>
                  {actionButtons(s)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">No syllabuses found</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

export default Syllabus;
