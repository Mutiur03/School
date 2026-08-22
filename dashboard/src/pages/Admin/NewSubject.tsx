import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader, SectionCard, StatsCard, Popup } from '@/components';
import DeleteConfirmation from '@/components/DeleteConfimation';
import ActionButton from '@/components/ActionButton';
import Loading from '@/components/Loading';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  subjectFormSchema,
  type SubjectFormSchemaData,
  VALID_GROUPS,
} from '@school/shared-schemas';
import ErrorMessage from '@/components/ErrorMessage';
import {
  useSubjects,
  useAddSubjects,
  useUpdateSubject,
  useDeleteSubject,
  useCloneSubjects,
} from '@/queries/subject.queries';
import type { Subject } from '@/types/subjects';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

// --- Sub-components (Memoized for performance) ---

const SubjectStats = React.memo(
  ({
    filteredCount,
    totalCount,
    loading,
  }: {
    filteredCount: number;
    totalCount: number;
    loading: boolean;
  }) => (
    <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
      <StatsCard
        label="Total Subjects"
        value={filteredCount === totalCount ? `${totalCount}` : `${filteredCount}/${totalCount}`}
        loading={loading}
      />
    </div>
  ),
);

const SubjectTableRow = React.memo(
  ({
    subject,
    isFirstChild,
    onShowInfo,
    onEdit,
    onDelete,
  }: {
    subject: Subject;
    isFirstChild: boolean;
    onShowInfo: (s: Subject) => void;
    onEdit: (s: Subject) => void;
    onDelete: (id: number) => void;
  }) => (
    <tr
      className={`hover:bg-muted/30 transition-colors ${subject.subject_type === 'paper' ? 'bg-muted/10' : ''} ${isFirstChild && subject.subject_type !== 'paper' ? 'border-border/50 border-t-2' : ''}`}
    >
      <td className="px-4 py-3 text-sm font-medium">
        <div className="flex items-center gap-2">
          {subject.subject_type === 'paper' && (
            <div className="border-border/50 ml-2 h-4 w-4 shrink-0 rounded-bl-md border-b-2 border-l-2" />
          )}
          <div className="flex flex-col">
            <span>{subject.name}</span>
            <div className="mt-0.5 flex items-center gap-2">
              {subject.priority > 0 && (
                <span className="text-muted-foreground text-[10px] font-normal">
                  Priority: {subject.priority}
                </span>
              )}
              {subject.assessment_type === 'continuous' && (
                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-tighter text-blue-600 uppercase">
                  CAS
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs">
        {subject.subject_type === 'main' ? (
          <span className="text-primary font-bold tracking-wider uppercase">Main</span>
        ) : subject.subject_type === 'paper' ? (
          <span className="text-muted-foreground tracking-wider uppercase">Paper</span>
        ) : (
          <span className="text-muted-foreground/50 capitalize italic">Single</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-col">
          <span>Class {subject.class}</span>
          {subject.group && (
            <span className="text-primary text-[10px] font-bold tracking-wider uppercase">
              {subject.group}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-medium">{subject.full_mark}</td>
      <td className="px-4 py-3 text-sm font-medium text-emerald-600">{subject.pass_mark}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="flex flex-wrap justify-end gap-1.5">
          <ActionButton action="view" onClick={() => onShowInfo(subject)} />
          <ActionButton action="edit" onClick={() => onEdit(subject)} />
          <DeleteConfirmation
            onDelete={() => onDelete(subject.id)}
            msg={`Permanently delete "${subject.name}" for class ${subject.class}? This action cannot be undone.`}
          />
        </div>
      </td>
    </tr>
  ),
);

const SubjectFilters = React.memo(
  ({
    filterYear,
    setFilterYear,
    filterClass,
    setFilterClass,
    filterGroup,
    setFilterGroup,
    filterType,
    setFilterType,
    searchTerm,
    setSearchTerm,
    onReset,
  }: {
    filterYear: number;
    setFilterYear: (v: number) => void;
    filterClass: number | 'all';
    setFilterClass: (v: number | 'all') => void;
    filterGroup: string | 'all';
    setFilterGroup: (v: string | 'all') => void;
    filterType: string | 'all';
    setFilterType: (v: string | 'all') => void;
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    onReset: () => void;
  }) => (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <div className="w-full sm:w-40">
        <label className="mb-1.5 block text-sm font-medium">Year</label>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value))}
          className="bg-card border-border text-foreground focus:ring-primary/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        >
          <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
          <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
          <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
        </select>
      </div>

      <div className="w-full sm:w-40">
        <label className="mb-1.5 block text-sm font-medium">Class</label>
        <select
          value={filterClass}
          onChange={(e) =>
            setFilterClass(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className="bg-card border-border text-foreground focus:ring-primary/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="all">All Classes</option>
          {[6, 7, 8, 9, 10].map((c) => (
            <option key={c} value={c}>
              Class {c}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full sm:w-40">
        <label className="mb-1.5 block text-sm font-medium">Group</label>
        <select
          value={filterGroup}
          disabled={filterClass !== 'all' && (filterClass as number) < 9}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="bg-card border-border text-foreground focus:ring-primary/30 disabled:bg-muted/50 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="all">All Groups</option>
          <option value="">General</option>
          {VALID_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full sm:w-40">
        <label className="mb-1.5 block text-sm font-medium">Type</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-card border-border text-foreground focus:ring-primary/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="main">Main (Groups)</option>
          <option value="paper">Paper (Parts)</option>
          <option value="single">Single Subject</option>
        </select>
      </div>

      <div className="min-w-[200px] flex-1">
        <label className="mb-1.5 block text-sm font-medium">Search Subject</label>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="flex h-10 items-end pb-0.5">
        <Button variant="outline" size="sm" onClick={onReset} className="h-9 text-xs">
          Reset
        </Button>
      </div>
    </div>
  ),
);

const SubjectForm = React.memo(
  ({
    register,
    handleSubmit,
    errors,
    isSubmitting,
    subjects,
    onCancel,
    onChange,
    setValue,
    control,
  }: {
    register: any;
    handleSubmit: any;
    errors: any;
    isSubmitting: boolean;
    subjects: Subject[];
    onCancel: () => void;
    onChange: (e: any) => void;
    setValue: any;
    control: any;
  }) => {
    const formData = useWatch({ control });
    const subjectType = formData.subject_type;
    const classNum = Number(formData.class);
    const assessmentType = formData.assessment_type;
    const markingScheme = formData.marking_scheme;

    // Cross-field validation for breakdown marks
    const validateBreakdown = () => {
      if (markingScheme !== 'BREAKDOWN') return true;
      if (subjectType === 'main') return true;

      const cq = Number(formData.cq_mark) || 0;
      const mcq = Number(formData.mcq_mark) || 0;
      const prac = Number(formData.practical_mark) || 0;

      return cq > 0 || mcq > 0 || prac > 0 || 'At least one mark (CQ/MCQ/Prac) is required';
    };

    const totalBreakdown =
      (Number(formData.cq_mark) || 0) +
      (Number(formData.mcq_mark) || 0) +
      (Number(formData.practical_mark) || 0);
    const totalPassBreakdown =
      (Number(formData.cq_pass_mark) || 0) +
      (Number(formData.mcq_pass_mark) || 0) +
      (Number(formData.practical_pass_mark) || 0);

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Subject Name <span className="text-destructive">*</span>
            </label>
            <Input type="text" {...register('name')} placeholder="e.g. Mathematics" />
            <ErrorMessage message={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Class (6-10) <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              {...register('class')}
              placeholder="e.g. 9"
              min={6}
              max={10}
              onChange={(e) => {
                onChange(e);
                register('class').onChange(e);
              }}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
            />
            <ErrorMessage message={errors.class?.message} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Full Mark <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              {...register('full_mark')}
              placeholder={subjectType === 'main' ? 'Auto-calculated' : 'e.g. 100'}
              disabled={subjectType === 'main'}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              className={subjectType === 'main' ? 'bg-muted cursor-not-allowed' : ''}
            />
            <ErrorMessage message={errors.full_mark?.message} />
            {subjectType === 'main' && (
              <p className="text-primary mt-1 animate-pulse text-[10px] font-medium">
                ✨ Automatically calculated from child subjects
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Pass Mark {assessmentType === 'exam' && <span className="text-destructive">*</span>}
            </label>
            <Input
              type="number"
              {...register('pass_mark')}
              placeholder={assessmentType === 'continuous' ? 'Optional for CAS' : 'e.g. 33'}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
            />
            <ErrorMessage message={errors.pass_mark?.message} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Subject Type <span className="text-destructive">*</span>
            </label>
            <select
              {...register('subject_type')}
              onChange={(e) => {
                onChange(e);
                register('subject_type').onChange(e);
              }}
              className="bg-card border-border text-foreground focus:ring-primary/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            >
              <option value="single">Single Subject</option>
              <option value="main">Main Subject (Group)</option>
              <option value="paper">Paper (Child Subject)</option>
            </select>
            <ErrorMessage message={errors.subject_type?.message} />
          </div>
          {subjectType === 'paper' && (
            <div className="animate-in fade-in slide-in-from-left-2 space-y-1.5 duration-200">
              <label className="text-sm font-medium">
                Parent Subject <span className="text-destructive">*</span>
              </label>
              <select
                {...register('parent_id')}
                className="bg-card border-border text-foreground focus:ring-primary/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              >
                <option value="">Select Parent Subject</option>
                {subjects
                  .filter((s) => s.subject_type === 'main' && s.class === classNum)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Class {s.class})
                    </option>
                  ))}
              </select>
              <ErrorMessage message={errors.parent_id?.message} />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Priority (Sort Order)</label>
            <Input type="number" {...register('priority')} placeholder="e.g. 10" />
            <ErrorMessage message={errors.priority?.message} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Assessment Type</label>
            <div className="flex h-10 items-center gap-4 px-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  value="exam"
                  {...register('assessment_type')}
                  checked={assessmentType === 'exam'}
                  onChange={(e) => {
                    onChange(e);
                    register('assessment_type').onChange(e);
                  }}
                  className="accent-primary"
                />
                <span className="text-sm">Exam Based</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  value="continuous"
                  {...register('assessment_type')}
                  checked={assessmentType === 'continuous'}
                  onChange={(e) => {
                    onChange(e);
                    register('assessment_type').onChange(e);
                  }}
                  className="accent-primary"
                />
                <span className="text-sm">Continuous</span>
              </label>
            </div>
            <ErrorMessage message={errors.assessment_type?.message} />
          </div>

          {subjectType !== 'main' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Marking Entry Scheme <span className="text-destructive">*</span>
              </label>
              <select
                {...register('marking_scheme' as any)}
                className="bg-card border-border text-foreground focus:ring-primary/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                value={markingScheme}
                onChange={(e) => {
                  setValue('marking_scheme' as any, e.target.value as any);
                }}
              >
                <option value="TOTAL">Total Marks Only</option>
                <option value="BREAKDOWN">Breakdown (CQ, MCQ, Practical)</option>
              </select>
              <ErrorMessage message={errors.marking_scheme?.message} />
            </div>
          )}
        </div>

        <fieldset
          className={`rounded-lg border p-4 transition-colors ${markingScheme === 'BREAKDOWN' ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}
        >
          <legend className="flex items-center gap-2 px-2 text-sm font-semibold">
            {markingScheme === 'BREAKDOWN'
              ? 'Mandatory Marks Breakdown'
              : 'Optional Marks Breakdown'}
            {markingScheme === 'BREAKDOWN' && <span className="text-destructive font-bold">*</span>}
          </legend>

          {markingScheme === 'BREAKDOWN' &&
            totalBreakdown > 0 &&
            Number(formData.full_mark) > 0 &&
            totalBreakdown !== Number(formData.full_mark) && (
              <div className="mb-4">
                <ErrorMessage
                  variant="block"
                  message={`Sum of breakdown marks (${totalBreakdown}) must equal Full Mark (${formData.full_mark}).`}
                />
              </div>
            )}

          {markingScheme === 'BREAKDOWN' &&
            totalPassBreakdown > 0 &&
            Number(formData.pass_mark) > 0 &&
            totalPassBreakdown !== Number(formData.pass_mark) && (
              <div className="mb-4">
                <ErrorMessage
                  variant="block"
                  message={`Sum of pass marks (${totalPassBreakdown}) must equal Pass Mark (${formData.pass_mark}).`}
                />
              </div>
            )}

          {(errors.cq_mark || errors.mcq_mark || errors.practical_mark) &&
            markingScheme === 'BREAKDOWN' && (
              <div className="mb-4">
                <ErrorMessage
                  variant="block"
                  message="At least one breakdown mark (CQ, MCQ, or Practical) must be provided for this scheme."
                />
              </div>
            )}

          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1 text-xs uppercase">
                CQ Mark{' '}
                {markingScheme === 'BREAKDOWN' && <span className="text-destructive">*</span>}
              </label>
              <Input
                type="number"
                {...register('cq_mark', { validate: validateBreakdown })}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
              <ErrorMessage message={errors.cq_mark?.message} />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1 text-xs uppercase">
                MCQ Mark{' '}
                {markingScheme === 'BREAKDOWN' && <span className="text-destructive">*</span>}
              </label>
              <Input
                type="number"
                {...register('mcq_mark', { validate: validateBreakdown })}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
              <ErrorMessage message={errors.mcq_mark?.message} />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1 text-xs uppercase">
                Practical Mark{' '}
                {markingScheme === 'BREAKDOWN' && <span className="text-destructive">*</span>}
              </label>
              <Input
                type="number"
                {...register('practical_mark', { validate: validateBreakdown })}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
              <ErrorMessage message={errors.practical_mark?.message} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 align-middle">
              <label className="text-muted-foreground flex items-center gap-1 text-xs uppercase">
                CQ Pass{' '}
                {markingScheme === 'BREAKDOWN' && <span className="text-destructive">*</span>}
              </label>
              <Input
                type="number"
                {...register('cq_pass_mark')}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
              <ErrorMessage message={errors.cq_pass_mark?.message} />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1 text-xs uppercase">
                MCQ Pass{' '}
                {markingScheme === 'BREAKDOWN' && <span className="text-destructive">*</span>}
              </label>
              <Input
                type="number"
                {...register('mcq_pass_mark')}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
              <ErrorMessage message={errors.mcq_pass_mark?.message} />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1 text-xs uppercase">
                Practical Pass{' '}
                {markingScheme === 'BREAKDOWN' && <span className="text-destructive">*</span>}
              </label>
              <Input
                type="number"
                {...register('practical_pass_mark')}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
              <ErrorMessage message={errors.practical_pass_mark?.message} />
            </div>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div
            className={`space-y-1.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ${classNum >= 9 ? 'opacity-100' : 'pointer-events-none opacity-40'}`}
          >
            <label className="text-sm font-medium">Group</label>
            <select
              {...register('group')}
              disabled={classNum < 9}
              className="bg-card border-border text-foreground focus:ring-primary/30 disabled:bg-muted/50 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            >
              <option value="">
                {classNum >= 9 ? 'General (Common for all)' : 'Not Required for Class 6-8'}
              </option>
              {VALID_GROUPS.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
            <ErrorMessage message={errors.group?.message} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Year</label>
            <Input type="number" {...register('year')} readOnly className="bg-muted opacity-80" />
            <ErrorMessage message={errors.year?.message} />
          </div>
        </div>

        <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Processing...' : formData.id ? 'Update Subject' : 'Submit Subject'}
          </Button>
        </div>
      </form>
    );
  },
);

const ExcelUploadForm = React.memo(
  ({
    onSubmitFile,
    onDownloadDemo,
    onShowFormatInfo,
    fileUploaded,
    isSubmitting,
    excelFileRef,
    onFileUpload,
    onCancel,
  }: {
    onSubmitFile: any;
    onDownloadDemo: () => void;
    onShowFormatInfo: () => void;
    fileUploaded: boolean;
    isSubmitting: boolean;
    excelFileRef: any;
    onFileUpload: (e: any) => void;
    onCancel: () => void;
  }) => (
    <form onSubmit={onSubmitFile} className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">Excel File Upload</h3>
          <p className="text-muted-foreground text-xs italic">
            Required columns: name, class, full_mark, pass_mark, year
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onDownloadDemo}
            className="h-8 px-3 text-xs"
          >
            Download Demo Excel
          </Button>
          <button
            type="button"
            onClick={onShowFormatInfo}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold transition-colors"
            title="View Excel format requirements"
          >
            i
          </button>
        </div>
      </div>
      <div className="relative">
        <input
          type="file"
          id="excelFile"
          accept=".xlsx, .xls"
          ref={excelFileRef}
          onChange={onFileUpload}
          className="absolute h-full w-full cursor-pointer opacity-0"
          required
        />
        <label
          htmlFor="excelFile"
          className="border-border hover:border-primary/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors"
        >
          <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            {fileUploaded ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            )}
          </div>
          <span className="text-sm font-medium">
            {fileUploaded ? 'File Ready to Upload' : 'Drop Excel file here or click to browse'}
          </span>
          <span className="text-muted-foreground mt-1 text-xs">.xlsx or .xls files only</span>
        </label>
      </div>
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!fileUploaded || isSubmitting}>
          {isSubmitting ? 'Uploading...' : 'Upload Subjects'}
        </Button>
      </div>
    </form>
  ),
);

const NewSubject: React.FC = () => {
  const { confirm, dialog } = useConfirmDialog();
  const { data: subjects = [], isLoading: isLoadingSubjects } = useSubjects();
  const addSubjectsMutation = useAddSubjects();
  const updateSubjectMutation = useUpdateSubject();
  const deleteSubjectMutation = useDeleteSubject();
  const cloneSubjectsMutation = useCloneSubjects();

  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterClass, setFilterClass] = useState<number | 'all'>('all');
  const [filterGroup, setFilterGroup] = useState<string | 'all'>('all');
  const [filterType, setFilterType] = useState<string | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const {
    register,
    handleSubmit: handleSub,
    reset,
    watch,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormSchemaData & { marking_scheme?: string }>({
    resolver: zodResolver(subjectFormSchema) as any,
    defaultValues: {
      id: null,
      name: '',
      class: null as any,
      full_mark: null as any,
      pass_mark: 0,
      cq_mark: 0,
      mcq_mark: 0,
      practical_mark: 0,
      cq_pass_mark: 0,
      mcq_pass_mark: 0,
      practical_pass_mark: 0,
      group: '',
      year: filterYear,
      subject_type: 'single',
      parent_id: null as any,
      assessment_type: 'exam',
      marking_scheme: 'TOTAL',
      priority: 0,
    },
  });

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'form' | 'file'>('form');
  const editingId = watch('id');

  const resetFormData = useCallback((): void => {
    reset({
      id: null,
      name: '',
      class: null as any,
      full_mark: null as any,
      pass_mark: 0,
      cq_mark: 0,
      mcq_mark: 0,
      practical_mark: 0,
      cq_pass_mark: 0,
      mcq_pass_mark: 0,
      practical_pass_mark: 0,
      group: '',
      year: filterYear,
      subject_type: 'single',
      parent_id: null as any,
      assessment_type: 'exam',
      marking_scheme: 'TOTAL',
      priority: 0,
    });
  }, [reset, filterYear]);
  const [jsonData, setJsonData] = useState<Subject[] | null>(null);
  const [fileUploaded, setFileUploaded] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [showFormatInfo, setShowFormatInfo] = useState<boolean>(false);
  const [showSubjectDetails, setShowSubjectDetails] = useState<boolean>(false);

  const excelFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue('year', filterYear);
  }, [filterYear, setValue]);

  const isLoading =
    isLoadingSubjects ||
    addSubjectsMutation.isPending ||
    updateSubjectMutation.isPending ||
    deleteSubjectMutation.isPending;

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
      const { name, value } = e.target;

      if (name === 'class') {
        const classNum = Number(value);
        if (classNum > 0 && classNum < 9) {
          setValue('class', classNum as any);
          setValue('group', '');
          return;
        }
      }

      if (name === 'assessment_type') {
        const val = value as 'exam' | 'continuous';
        setValue('assessment_type', val);
        return;
      }

      const numericFields = [
        'class',
        'full_mark',
        'pass_mark',
        'cq_mark',
        'mcq_mark',
        'practical_mark',
        'cq_pass_mark',
        'mcq_pass_mark',
        'practical_pass_mark',
        'year',
        'priority',
        'parent_id',
      ];
      if (numericFields.includes(name)) {
        setValue(name as any, value === '' ? null : Number(value));
      } else {
        setValue(name as any, value);
      }
    },
    [setValue],
  );

  const handleMethodChange = useCallback(
    (method: 'form' | 'file'): void => {
      setUploadMethod(method);
      if (method === 'form') {
        resetFormData();
      }
    },
    [resetFormData],
  );

  const onSubmit = useCallback(
    async (data: any): Promise<void> => {
      if (uploadMethod === 'form') {
        // Client-side check for breakdown marks
        const isBreakdownScheme = data.marking_scheme === 'BREAKDOWN';
        const isNotMain = data.subject_type !== 'main';

        console.log('Submitting subject data:', {
          name: data.name,
          class: data.class,
          group: data.group || 'General',
          marking_scheme: data.marking_scheme,
          isBreakdownScheme,
          isNotMain,
          cq: data.cq_mark,
          mcq: data.mcq_mark,
          prac: data.practical_mark,
        });

        if (isBreakdownScheme && isNotMain) {
          const cq = Number(data.cq_mark) || 0;
          const mcq = Number(data.mcq_mark) || 0;
          const prac = Number(data.practical_mark) || 0;

          if (cq <= 0 && mcq <= 0 && prac <= 0) {
            console.error('Validation failed: At least one breakdown mark required.', {
              cq,
              mcq,
              prac,
            });
            setError('cq_mark', { type: 'manual', message: 'CQ Mark required if MCQ/Prac are 0' });
            setError('mcq_mark', { type: 'manual', message: 'MCQ Mark required if CQ/Prac are 0' });
            setError('practical_mark', {
              type: 'manual',
              message: 'Practical Mark required if CQ/MCQ are 0',
            });
            toast.error(
              'At least one breakdown mark (CQ, MCQ, or Practical) MUST be greater than zero for BREAKDOWN subjects.',
            );
            return;
          }
        }

        try {
          if (data.id) {
            const originalSubject = subjects.find((s) => s.id === data.id);
            await updateSubjectMutation.mutateAsync({
              id: data.id,
              data,
              old_parent_id: originalSubject?.parent_id,
            });
          } else {
            await addSubjectsMutation.mutateAsync([data]);
          }
          resetFormData();
          setShowForm(false);
        } catch (error: any) {
          console.error('Submit error:', error);
          const serverErrors = error.response?.data?.errors;
          if (Array.isArray(serverErrors) && serverErrors.length > 0) {
            serverErrors.forEach((err: any) => {
              if (err.path && err.path.length > 0) {
                const fieldName = err.path[err.path.length - 1];
                // Map server error to form field
                setError(fieldName as any, { type: 'server', message: err.message });
              }
            });
          }
        }
      }
    },
    [uploadMethod, subjects, updateSubjectMutation, addSubjectsMutation, resetFormData],
  );

  const onError = useCallback((errors: any) => {
    console.error('Form validation errors:', errors);
    toast.error('Please fix the validation errors in the form.');
  }, []);

  // Improved Excel upload pipeline (Memoized)
  const handleFileUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      if (!file) return;
      setFileUploaded(true);
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result;
        if (!arrayBuffer) return;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        const mandatoryColumns = [
          'name',
          'class',
          'full_mark',
          'year',
          'assessment_type',
          'priority',
        ];
        const sheetHeaders = (rawData[0] || []) as string[];
        const missingColumns = mandatoryColumns.filter((col) => !sheetHeaders.includes(col));
        if (missingColumns.length > 0) {
          toast.error(`Excel file is missing required columns: ${missingColumns.join(', ')}`);
          setFileUploaded(false);
          return;
        }
        const data = XLSX.utils.sheet_to_json(sheet) as any[];
        const errors: string[] = [];
        const normalizedRows = data.map((row) => {
          // More robust key matching for 'group' and other optional columns
          const findKeyByValue = (searchVal: string) =>
            Object.keys(row).find(
              (k) => String(k).trim().toLowerCase() === searchVal.toLowerCase(),
            );

          const groupKey = findKeyByValue('group');
          const groupRaw = groupKey ? String(row[groupKey as keyof typeof row] || '').trim() : '';

          const subjectGroupKey = findKeyByValue('subject_group');
          const subjectGroupRaw = subjectGroupKey
            ? String(row[subjectGroupKey as keyof typeof row] || '').trim()
            : null;

          const group = groupRaw
            ? groupRaw.charAt(0).toUpperCase() + groupRaw.slice(1).toLowerCase()
            : '';
          return {
            ...row,
            name: String(row.name || '').trim(),
            class: Number(row.class),
            full_mark: Number(row.full_mark),
            pass_mark:
              row.assessment_type?.toLowerCase() === 'continuous' ? null : Number(row.pass_mark),
            group: group === 'General' ? '' : group,
            year: Number(row.year) || new Date().getFullYear(),
            assessment_type: String(row.assessment_type || 'exam').toLowerCase(),
            subject_group: subjectGroupRaw,
            priority: Number(row.priority) || 0,
            cq_mark: Number(row.cq_mark) || 0,
            mcq_mark: Number(row.mcq_mark) || 0,
            practical_mark: Number(row.practical_mark) || 0,
            cq_pass_mark: Number(row.cq_pass_mark) || 0,
            mcq_pass_mark: Number(row.mcq_pass_mark) || 0,
            practical_pass_mark: Number(row.practical_pass_mark) || 0,
            marking_scheme: row.marking_scheme ? String(row.marking_scheme).toUpperCase() : 'TOTAL',
          };
        });
        const seen = new Set();
        normalizedRows.forEach((row, index) => {
          const rowNum = index + 2;
          const key = `${row.name}|${row.class}|${row.group}|${row.year}`;
          if (!row.name) errors.push(`Row ${rowNum}: Subject name required.`);
          if (!row.class || isNaN(row.class) || row.class < 6 || row.class > 10)
            errors.push(`Row ${rowNum}: Class must be 6-10.`);
          if (!row.full_mark || isNaN(row.full_mark) || row.full_mark <= 0)
            errors.push(`Row ${rowNum}: Full mark required.`);
          if (
            row.assessment_type === 'exam' &&
            (row.pass_mark === null || isNaN(row.pass_mark) || row.pass_mark < 0)
          )
            errors.push(`Row ${rowNum}: Pass mark required for exam.`);
          if (!row.year || isNaN(row.year) || row.year < 2000)
            errors.push(`Row ${rowNum}: Invalid year.`);
          if (!['exam', 'continuous'].includes(row.assessment_type))
            errors.push(`Row ${rowNum}: Invalid assessment type.`);
          if (row.priority < 0) errors.push(`Row ${rowNum}: Priority must be non-negative.`);
          if (
            row.marking_scheme === 'BREAKDOWN' &&
            (Number(row.cq_mark) || 0) === 0 &&
            (Number(row.mcq_mark) || 0) === 0 &&
            (Number(row.practical_mark) || 0) === 0
          ) {
            errors.push(
              `Row ${rowNum}: BREAKDOWN scheme requires at least one mark type (CQ, MCQ, or Practical).`,
            );
          }

          // Sum validation for breakdown marks
          const totalBreakdown =
            (Number(row.cq_mark) || 0) +
            (Number(row.mcq_mark) || 0) +
            (Number(row.practical_mark) || 0);
          if (totalBreakdown > 0 && row.full_mark !== totalBreakdown) {
            errors.push(
              `Row ${rowNum}: Full mark (${row.full_mark}) must equal sum of CQ, MCQ, and Practical (${totalBreakdown}).`,
            );
          }

          // Sum validation for pass marks
          const totalPassBreakdown =
            (Number(row.cq_pass_mark) || 0) +
            (Number(row.mcq_pass_mark) || 0) +
            (Number(row.practical_pass_mark) || 0);
          if (totalPassBreakdown > 0 && row.pass_mark !== totalPassBreakdown) {
            errors.push(
              `Row ${rowNum}: Pass mark (${row.pass_mark}) must equal sum of breakdown pass marks (${totalPassBreakdown}).`,
            );
          }

          if (row.pass_mark > row.full_mark) {
            errors.push(
              `Row ${rowNum}: Pass mark (${row.pass_mark}) cannot exceed full mark (${row.full_mark}).`,
            );
          }

          if (!['TOTAL', 'BREAKDOWN'].includes(row.marking_scheme))
            errors.push(`Row ${rowNum}: Invalid marking scheme (must be TOTAL or BREAKDOWN).`);
          if (seen.has(key)) errors.push(`Row ${rowNum}: Duplicate subject in file.`);
          seen.add(key);
          const isDuplicateInDB = subjects.some(
            (s) =>
              s.name === row.name &&
              s.class === row.class &&
              (s.group || '') === row.group &&
              s.year === row.year,
          );
          if (isDuplicateInDB) errors.push(`Row ${rowNum}: Subject already exists in database.`);
        });
        if (errors.length > 0) {
          errors.slice(0, 5).forEach((err) => toast.error(err, { duration: 4000 }));
          if (errors.length > 5) toast.error(`...and ${errors.length - 5} more rows have errors.`);
          setFileUploaded(false);
          setJsonData(null);
          if (excelFileRef.current) excelFileRef.current.value = '';
          return;
        }
        const subjectsToUpload: any[] = normalizedRows.map((row) => {
          // Optimization: Let the backend handle auto-grouping via subject_group.
          // We set subject_type to 'single' if parent_id is null to pass frontend/backend validation.
          // The backend will promote it to 'paper' if a subject_group matches.
          return {
            ...row,
            subject_type: row.subject_type || 'single',
            parent_id: row.parent_id || null,
          };
        });
        subjectsToUpload.forEach((s) => {
          if (s.assessment_type === 'continuous') s.pass_mark = null;
        });
        setJsonData(subjectsToUpload);
      };
      reader.onerror = () => {
        toast.error('Error reading the file. Please try again.');
        setFileUploaded(false);
      };
    },
    [subjects],
  );

  const handleDownloadDemoExcel = useCallback(() => {
    const link = document.createElement('a');
    link.href = '/subject_upload_demo.xlsx';
    link.download = 'demo_subjects.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Demo Excel downloaded.');
  }, []);

  const onSubmitFile = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      if (!jsonData || jsonData.length === 0) {
        toast.error('No data to upload. Please check your Excel file.');
        return;
      }
      try {
        await addSubjectsMutation.mutateAsync(jsonData);
        setFileUploaded(false);
        setJsonData(null);
        if (excelFileRef.current) {
          excelFileRef.current.value = '';
        }
        setShowForm(false);
      } catch (err: any) {
        // Error handling is inside the mutation's onError
        console.error('Upload error:', err);
        // If we want to show specifically which subjects failed in a bulk upload, we'd need better server feedback
      }
    },
    [jsonData, addSubjectsMutation],
  );

  const deleteSubject = useCallback(
    async (id: number): Promise<void> => {
      try {
        await deleteSubjectMutation.mutateAsync(id);
      } catch (error) {
        console.error('Delete error:', error);
      }
    },
    [deleteSubjectMutation],
  );

  const editSubject = useCallback(
    (subject: Subject): void => {
      reset({
        id: subject.id,
        name: subject.name,
        class: subject.class as any,
        full_mark: subject.full_mark as any,
        pass_mark: subject.pass_mark as any,
        cq_mark: (subject.cq_mark || 0) as any,
        mcq_mark: (subject.mcq_mark || 0) as any,
        practical_mark: (subject.practical_mark || 0) as any,
        cq_pass_mark: (subject.cq_pass_mark || 0) as any,
        mcq_pass_mark: (subject.mcq_pass_mark || 0) as any,
        practical_pass_mark: (subject.practical_pass_mark || 0) as any,
        group: subject.group || '',
        year: subject.year,
        subject_type: subject.subject_type,
        parent_id: (subject.parent_id || null) as any,
        assessment_type: subject.assessment_type,
        marking_scheme: (subject as any).marking_scheme || 'TOTAL',
        priority: subject.priority as any,
      });
      setUploadMethod('form');
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [reset],
  );

  const handleCancel = useCallback(() => {
    resetFormData();
    setUploadMethod('form');
    setFileUploaded(false);
    setJsonData(null);
    if (excelFileRef.current) {
      excelFileRef.current.value = '';
    }
    setShowForm(false);
  }, [resetFormData]);

  const showSubjectInfo = useCallback((subject: Subject): void => {
    setSelectedSubject(subject);
    setShowSubjectDetails(true);
  }, []);

  const stats = useMemo(() => {
    const yearSubjects = subjects.filter((s) => s.year === filterYear);
    return {
      total: yearSubjects.length,
    };
  }, [subjects, filterYear]);

  const filteredSubjects = useMemo(() => {
    let baseFilter = subjects.filter((subject) => subject.year === filterYear);

    if (filterClass !== 'all') {
      baseFilter = baseFilter.filter((s) => s.class === filterClass);
    }
    if (filterGroup !== 'all') {
      baseFilter = baseFilter.filter((s) => (s.group || '') === filterGroup);
    }
    if (filterType !== 'all') {
      baseFilter = baseFilter.filter((s) => s.subject_type === filterType);
    }
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      baseFilter = baseFilter.filter((s) => s.name.toLowerCase().includes(term));
    }

    // Enhanced sorting logic:
    const sorted = [...baseFilter].sort((a, b) => {
      if (a.class !== b.class) return a.class - b.class;
      if (a.priority !== b.priority) return a.priority - b.priority;
      const typeOrder = { main: 0, single: 1, paper: 2 };
      const aTypeOrder = typeOrder[a.subject_type as keyof typeof typeOrder] ?? 2;
      const bTypeOrder = typeOrder[b.subject_type as keyof typeof typeOrder] ?? 2;
      if (aTypeOrder !== bTypeOrder) return aTypeOrder - bTypeOrder;
      return a.name.localeCompare(b.name);
    });

    const result: Subject[] = [];
    const processedIds = new Set<number>();

    sorted.forEach((subject) => {
      if (subject.subject_type === 'main' || subject.subject_type === 'single') {
        result.push(subject);
        processedIds.add(subject.id);

        if (subject.subject_type === 'main') {
          const childPapers = sorted
            .filter((p) => p.subject_type === 'paper' && p.parent_id === subject.id)
            .sort((a, b) => {
              if (a.priority !== b.priority) return a.priority - b.priority;
              return a.name.localeCompare(b.name);
            });
          result.push(...childPapers);
          childPapers.forEach((p) => processedIds.add(p.id));
        }
      }
    });

    sorted.forEach((subject) => {
      if (!processedIds.has(subject.id)) {
        result.push(subject);
      }
    });

    return result;
  }, [subjects, filterYear, filterClass, filterGroup, filterType, debouncedSearchTerm]);

  const onResetFilters = useCallback(() => {
    setFilterYear(new Date().getFullYear());
    setFilterClass('all');
    setFilterGroup('all');
    setFilterType('all');
    setSearchTerm('');
  }, []);

  const handleEdit = useCallback((subject: Subject) => editSubject(subject), [subjects]); // Simplified for brevity in this replace
  const handleDelete = useCallback((id: number) => deleteSubject(id), []);
  const handleShowInfo = useCallback((subject: Subject) => showSubjectInfo(subject), []);

  const handleClone = useCallback(async () => {
    const fromYear = filterYear - 1;
    const toYear = filterYear;

    const ok = await confirm({
      title: 'Clone subjects?',
      msg: `Clone all subjects from ${fromYear} to ${toYear}? This will only work if ${toYear} has no subjects yet.`,
      confirmLabel: 'Clone Subjects',
      variant: 'default',
    });
    if (!ok) return;

    try {
      await cloneSubjectsMutation.mutateAsync({ fromYear, toYear });
    } catch (error) {
      console.error('Clone error:', error);
    }
  }, [filterYear, cloneSubjectsMutation, confirm]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      {dialog}
      <PageHeader
        title="Subject Management"
        description="Manage school subjects, marks, and groups."
      >
        {!showForm && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClone}
              disabled={isLoading || stats.total > 0}
              title={stats.total > 0 ? 'Year already has subjects' : `Clone from ${filterYear - 1}`}
            >
              {cloneSubjectsMutation.isPending ? 'Cloning...' : `Clone from ${filterYear - 1}`}
            </Button>
            <Button type="button" onClick={() => setShowForm((prev) => !prev)} disabled={isLoading}>
              {isLoading ? 'Loading...' : '+ Add New Subject'}
            </Button>
          </div>
        )}
      </PageHeader>

      {showForm && (
        <SectionCard className="animate-in fade-in slide-in-from-top-4 mb-6 duration-300">
          <h2 className="text-foreground mb-6 text-xl font-bold">
            {editingId ? 'Edit Subject' : 'Add New Subject'}
          </h2>
          {!editingId && (
            <div className="border-border mb-6 flex gap-1 border-b">
              <button
                onClick={() => handleMethodChange('form')}
                className={`relative px-3 pb-2 text-sm font-medium transition-colors ${
                  uploadMethod === 'form'
                    ? 'text-primary border-primary border-b-2'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Form
              </button>
              <button
                onClick={() => handleMethodChange('file')}
                className={`relative px-3 pb-2 text-sm font-medium transition-colors ${
                  uploadMethod === 'file'
                    ? 'text-primary border-primary border-b-2'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Excel Upload
              </button>
            </div>
          )}

          <div className="space-y-4 sm:space-y-6">
            {uploadMethod === 'form' ? (
              <SubjectForm
                register={register}
                handleSubmit={handleSub(onSubmit as any, onError)}
                errors={errors}
                isSubmitting={isSubmitting}
                subjects={subjects}
                onCancel={handleCancel}
                onChange={handleChange}
                setValue={setValue}
                control={control}
              />
            ) : (
              <ExcelUploadForm
                onSubmitFile={onSubmitFile}
                onDownloadDemo={handleDownloadDemoExcel}
                onShowFormatInfo={() => setShowFormatInfo(true)}
                fileUploaded={fileUploaded}
                isSubmitting={isSubmitting}
                excelFileRef={excelFileRef}
                onFileUpload={handleFileUpload}
                onCancel={handleCancel}
              />
            )}
          </div>
        </SectionCard>
      )}
      <SubjectStats
        filteredCount={filteredSubjects.length}
        totalCount={stats.total}
        loading={isLoading}
      />

      <SectionCard className="mb-6">
        <SubjectFilters
          filterYear={filterYear}
          setFilterYear={setFilterYear}
          filterClass={filterClass}
          setFilterClass={setFilterClass}
          filterGroup={filterGroup}
          setFilterGroup={setFilterGroup}
          filterType={filterType}
          setFilterType={setFilterType}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onReset={onResetFilters}
        />

        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[800px] border-collapse text-left">
            <thead>
              <tr className="bg-muted/50 border-border border-b">
                {['Subject', 'Type', 'Class', 'Full Mark', 'Pass Mark', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className={`text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wider uppercase ${h === 'Actions' ? 'text-center' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground py-20 text-center">
                    <Loading />
                  </td>
                </tr>
              ) : filteredSubjects.length > 0 ? (
                filteredSubjects.map((subject, index) => {
                  const isFirstChild =
                    index === 0 ||
                    filteredSubjects[index - 1].class !== subject.class ||
                    (filteredSubjects[index - 1].subject_type === 'main' &&
                      subject.subject_type === 'paper' &&
                      filteredSubjects[index - 1].id === subject.parent_id);

                  return (
                    <SubjectTableRow
                      key={subject.id}
                      subject={subject}
                      isFirstChild={isFirstChild}
                      onShowInfo={handleShowInfo}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-muted-foreground px-4 py-12 text-center text-sm">
                    No subjects found with the selected filters. Try adjusting your filters or
                    adding a new subject.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Popup open={showSubjectDetails} onOpenChange={setShowSubjectDetails} size="md">
        <div className="p-6">
          <div className="border-border mb-6 flex items-center justify-between border-b pb-4">
            <h2 className="font-heading text-xl font-bold">Subject Details</h2>
            <button
              onClick={() => setShowSubjectDetails(false)}
              className="text-muted-foreground hover:text-foreground text-2xl transition-colors"
            >
              ×
            </button>
          </div>

          {selectedSubject && (
            <div className="space-y-6">
              <div className="bg-primary/5 border-primary/10 flex items-center justify-between rounded-xl border p-5">
                <div>
                  <h3 className="text-primary text-2xl font-bold tracking-tight">
                    {selectedSubject.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
                      Class {selectedSubject.class}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {selectedSubject.group || 'General'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block text-[10px] font-bold tracking-widest uppercase">
                    Academic Year
                  </span>
                  <span className="text-lg font-bold">{selectedSubject.year}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 border-border rounded-xl border p-4">
                  <span className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-widest uppercase">
                    Full Mark
                  </span>
                  <span className="text-2xl font-bold">{selectedSubject.full_mark}</span>
                </div>
                <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4">
                  <span className="mb-1 block text-[10px] font-bold tracking-widest text-emerald-600 uppercase">
                    Pass Mark
                  </span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {selectedSubject.pass_mark}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-muted-foreground flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
                  <span className="bg-primary h-4 w-1 rounded-full"></span>
                  Marks Distribution
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/40 border-border/50 rounded-lg border p-3 text-center">
                    <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                      CQ
                    </span>
                    <span className="text-sm font-bold">{selectedSubject.cq_mark || 0}</span>
                    <div className="bg-border mx-2 my-1 h-px"></div>
                    <span className="text-muted-foreground text-[8px] tracking-tighter uppercase">
                      Pass: {selectedSubject.cq_pass_mark || 0}
                    </span>
                  </div>
                  <div className="bg-muted/40 border-border/50 rounded-lg border p-3 text-center">
                    <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                      MCQ
                    </span>
                    <span className="text-sm font-bold">{selectedSubject.mcq_mark || 0}</span>
                    <div className="bg-border mx-2 my-1 h-px"></div>
                    <span className="text-muted-foreground text-[8px] tracking-tighter uppercase">
                      Pass: {selectedSubject.mcq_pass_mark || 0}
                    </span>
                  </div>
                  <div className="bg-muted/40 border-border/50 rounded-lg border p-3 text-center">
                    <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                      Practical
                    </span>
                    <span className="text-sm font-bold">{selectedSubject.practical_mark || 0}</span>
                    <div className="bg-border mx-2 my-1 h-px"></div>
                    <span className="text-muted-foreground text-[8px] tracking-tighter uppercase">
                      Pass: {selectedSubject.practical_pass_mark || 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => setShowSubjectDetails(false)} className="w-full sm:w-auto">
                  Close Details
                </Button>
              </div>
            </div>
          )}
        </div>
      </Popup>

      <Popup open={showFormatInfo} onOpenChange={setShowFormatInfo} size="lg">
        <div className="p-6">
          <div className="border-border mb-6 flex items-center justify-between border-b pb-4">
            <h2 className="font-heading text-xl font-bold">Excel Format Guide</h2>
            <button
              onClick={() => setShowFormatInfo(false)}
              className="text-muted-foreground hover:text-foreground text-2xl transition-colors"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-muted/50 border-border rounded-xl border border-dashed p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
                <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full"></span>
                Required Columns
              </h3>
              <div className="flex flex-wrap gap-2">
                {['name', 'class', 'full_mark', 'pass_mark', 'year'].map((col) => (
                  <span
                    key={col}
                    className="bg-background border-border rounded-md border px-3 py-1.5 font-mono text-xs shadow-sm"
                  >
                    {col}
                  </span>
                ))}
                <span className="bg-primary/5 border-primary/20 text-primary rounded-md border px-3 py-1.5 font-mono text-xs shadow-sm">
                  group
                </span>
                <span className="bg-primary/5 border-primary/20 text-primary rounded-md border px-3 py-1.5 font-mono text-xs shadow-sm">
                  subject_group
                </span>
                <span className="bg-primary/5 border-primary/20 text-primary rounded-md border px-3 py-1.5 font-mono text-xs shadow-sm">
                  priority
                </span>
                <span className="bg-primary/5 border-primary/20 text-primary rounded-md border px-3 py-1.5 font-mono text-xs shadow-sm">
                  assessment_type
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="bg-primary/10 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                    1
                  </div>
                  <p>
                    <strong>name:</strong> The full title of the subject (e.g. Mathematics,
                    Physics).
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-primary/10 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                    2
                  </div>
                  <p>
                    <strong>class:</strong> Only numeric values between 6 and 10 are accepted.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-primary/10 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                    3
                  </div>
                  <p>
                    <strong>full_mark:</strong> Total assignable marks for the subject.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="bg-primary/10 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                    4
                  </div>
                  <p>
                    <strong>pass_mark:</strong> Minimum marks required to pass.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-primary/10 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                    5
                  </div>
                  <p>
                    <strong>group:</strong> Optional. Science/Humanities/Commerce (Common for all if
                    empty).
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-primary/10 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                    6
                  </div>
                  <p>
                    <strong>year:</strong> Four-digit academic year (e.g. {new Date().getFullYear()}
                    ).
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-primary/10 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                    7
                  </div>
                  <p>
                    <strong>marking_scheme:</strong> Optional. [TOTAL | BREAKDOWN]. Defaults to
                    TOTAL for all classes.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
              <Search className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                <strong>Pro Tip:</strong> Optional fields like `cq_mark`, `mcq_mark`, and
                `practical_mark` (and their respective pass marks) can also be added as columns for
                automatic breakdown.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setShowFormatInfo(false)}
                variant="default"
                className="w-full sm:w-auto"
              >
                Understood
              </Button>
            </div>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default NewSubject;
