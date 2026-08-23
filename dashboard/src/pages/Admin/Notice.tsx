import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import {
  Loader2,
  Inbox,
  List as ListIcon,
  Search,
  FileText,
  Calendar,
  ExternalLink,
  X,
  Plus,
} from 'lucide-react';
import {
  Loading,
  PageHeader,
  StatsCard,
  SectionCard,
  ActionButton,
  DeleteConfirmation,
} from '@/components';
import {
  useNotices,
  useAddNotice,
  useUpdateNotice,
  useDeleteNotice,
} from '@/queries/notice.queries';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { noticeSchema, type NoticeFormData } from '@school/shared-schemas';
import { getFileUrl } from '@/lib/backend';

const NoticeUploadPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState<boolean>(false);
  const fileref = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | number | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NoticeFormData>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      title: '',
      file: undefined,
      created_at: '',
    },
  });

  const formFile = watch('file');

  const { data: notices = [], isLoading } = useNotices();
  const addMutation = useAddNotice();
  const updateMutation = useUpdateNotice();
  const deleteMutation = useDeleteNotice();

  const isSubmitting = addMutation.isPending || updateMutation.isPending;

  const filteredNotices = useMemo(() => {
    if (!searchQuery) return notices;
    return notices.filter((n) => n.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [notices, searchQuery]);

  const onFormSubmit = async (data: NoticeFormData) => {
    if (!isEditing && !data.file) {
      toast.error('Please select a document');
      return;
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: editId!,
          data: {
            title: data.title,
            file: data.file instanceof File ? data.file : undefined,
            created_at: data.created_at,
          },
        });
      } else {
        await addMutation.mutateAsync({
          title: data.title,
          file: data.file as File,
          created_at: data.created_at,
        });
      }
      handleCancel();
    } catch (error) {
      console.error('Error submitting form:', error);
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast.error(message);
    }
  };

  const handleCancel = () => {
    reset();
    if (fileref.current) fileref.current.value = '';
    setIsEditing(false);
    setEditId(null);
    setShowForm(false);
  };

  const handleDelete = async (id: string | number) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Error deleting notice:', error);
      toast.error('Failed to delete notice');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Notice Management"
        description="Publish and manage school notices, announcements, and documents."
      >
        <Button
          onClick={() => {
            if (showForm) handleCancel();
            else {
              reset({ title: '', file: undefined, created_at: '' });
              setIsEditing(false);
              setEditId(null);
              setShowForm(true);
              window.scrollTo({ top: 0, behavior: 'auto' });
            }
          }}
          className="flex items-center gap-2 px-6 shadow-sm"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Publish Notice
            </>
          )}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatsCard
          label="Total Notices"
          value={notices.length}
          loading={isLoading}
          icon={<FileText className="text-primary h-5 w-5" />}
          color="blue"
        />
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <SectionCard className="mb-8 overflow-hidden">
              <h2 className="text-foreground mb-6 text-xl font-bold">
                {isEditing ? 'Update Notice Info' : 'Add New Notice Publication'}
              </h2>

              <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
                <fieldset className="border-border bg-card rounded-lg border p-4 sm:p-5">
                  <legend className="border-primary border-l-2 px-2 text-sm font-semibold sm:text-base">
                    Notice Details
                  </legend>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">
                        Notice Title <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="title"
                        placeholder="e.g. Annual Sports Day 2026 Schedule"
                        {...register('title')}
                        className={`bg-background focus:ring-primary/20 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 ${errors.title ? 'border-destructive' : ''}`}
                      />
                      {errors.title && (
                        <p className="text-destructive mt-1 text-xs">{errors.title.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground block text-sm font-medium">
                        Publish Date (Optional)
                      </label>
                      <Input
                        id="created_at"
                        type="date"
                        {...register('created_at')}
                        className="bg-background focus:ring-primary/20 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-foreground block px-0.5 text-sm font-medium">
                        {isEditing ? 'Notice File (PDF)' : 'Document (PDF Only) *'}
                      </label>

                      <div
                        className={`flex min-h-[58px] items-center justify-between gap-3 rounded-2xl border bg-slate-50/10 p-1.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] ${errors.file ? 'border-destructive' : 'border-slate-200 dark:border-slate-800'}`}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            id="file"
                            type="file"
                            accept=".pdf"
                            ref={fileref}
                            className="hidden"
                            onChange={(e) =>
                              setValue('file', e.target.files?.[0] || null, {
                                shouldValidate: true,
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => fileref.current?.click()}
                            className="ml-1 shrink-0 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold whitespace-nowrap text-[#2D5BFF] transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-[#4A7DFF] dark:hover:bg-slate-700"
                          >
                            Choose File
                          </button>
                          <span className="max-w-[140px] truncate text-sm font-medium text-slate-500 sm:max-w-md dark:text-slate-400">
                            {formFile instanceof File ? formFile.name : 'No file chosen'}
                          </span>
                        </div>

                        {isEditing && typeof formFile === 'string' ? (
                          <a
                            href={getFileUrl(formFile)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group hover:bg-primary/5 mr-2 flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors"
                          >
                            <FileText className="group-hover:text-primary h-5 w-5 text-slate-400 transition-colors" />
                            <span className="group-hover:text-primary hidden text-sm font-bold text-slate-600 transition-colors sm:inline dark:text-slate-400">
                              Current Notice
                            </span>
                          </a>
                        ) : (
                          <div className="pr-4">
                            <FileText className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                      </div>
                      {errors.file && (
                        <p className="text-destructive mt-1 ml-1 text-xs font-medium">
                          {errors.file.message as string}
                        </p>
                      )}
                    </div>
                  </div>
                </fieldset>

                <div className="bg-card/95 border-border sticky bottom-0 flex justify-between gap-4 border-t pt-4 backdrop-blur">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    type="button"
                    disabled={isSubmitting}
                    className="min-w-24"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="min-w-28">
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isEditing ? 'Updating...' : 'Publishing...'}
                      </span>
                    ) : isEditing ? (
                      'Update Notice'
                    ) : (
                      'Confirm Publication'
                    )}
                  </Button>
                </div>
              </form>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      <SectionCard
        title="Notices"
        icon={<ListIcon className="h-5 w-5" />}
        noPadding
        headerAction={
          <div className="relative w-full max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search notices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-muted/30 focus:bg-background focus:border-border h-9 border-transparent pl-9 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            />
          </div>
        }
      >
        {isLoading ? (
          <div className="p-12">
            <Loading />
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-24 text-center">
            <div className="bg-muted/40 text-muted-foreground/60 border-border flex h-20 w-20 items-center justify-center rounded-full border border-dashed">
              <Inbox size={32} />
            </div>
            <div className="max-w-xs space-y-1">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                No notices found
              </h4>
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? `No matches found for "${searchQuery}"`
                  : "You haven't published any notices yet."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Desktop Table View */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-border bg-muted/20 border-b">
                    <th className="text-muted-foreground w-[60%] p-4 pl-6 text-left text-xs font-bold tracking-wider uppercase">
                      Notice Title
                    </th>
                    <th className="text-muted-foreground p-4 text-left text-xs font-bold tracking-wider uppercase">
                      Published Date
                    </th>
                    <th className="text-muted-foreground p-4 pr-6 text-right text-xs font-bold tracking-wider uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
                  {filteredNotices.map((notice) => (
                    <motion.tr
                      key={notice.id}
                      variants={itemVariants}
                      className="border-border/50 hover:bg-muted/30 group border-b transition-colors"
                    >
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110">
                            <FileText size={18} />
                          </div>
                          <span
                            className="group-hover:text-primary max-w-md truncate font-bold text-gray-900 transition-colors dark:text-white"
                            title={notice.title}
                          >
                            {notice.title}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4" />
                          {notice.created_at.split('T')[0]}
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <ActionButton
                            action="view"
                            onClick={() => window.open(getFileUrl(notice.file), '_blank')}
                          />
                          <ActionButton
                            action="edit"
                            onClick={() => {
                              setIsEditing(true);
                              setEditId(notice.id);
                              reset({
                                title: notice.title,
                                file: notice.file,
                                created_at: notice.created_at
                                  ? notice.created_at.split('T')[0]
                                  : '',
                              });
                              setShowForm(true);
                              window.scrollTo({ top: 0, behavior: 'auto' });
                            }}
                          />
                          <DeleteConfirmation
                            onDelete={() => handleDelete(notice.id)}
                            msg={`Are you sure you want to delete "${notice.title}"? This will permanently remove the PDF from storage.`}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-4 p-4"
              >
                {filteredNotices.map((notice) => (
                  <motion.div
                    key={notice.id}
                    variants={itemVariants}
                    className="border-border bg-card group relative space-y-4 overflow-hidden rounded-xl border p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="line-clamp-2 text-sm leading-snug font-bold">
                          {notice.title}
                        </h4>
                        <div className="text-muted-foreground flex items-center gap-2 text-[10px] font-medium tracking-wider uppercase">
                          <Calendar className="h-3 w-3" />
                          {notice.created_at.split('T')[0]}
                        </div>
                      </div>
                    </div>
                    <div className="border-border/50 flex items-center justify-between border-t pt-3">
                      <div className="flex gap-1.5">
                        <ActionButton
                          action="view"
                          onClick={() => window.open(getFileUrl(notice.file), '_blank')}
                        />
                        <ActionButton
                          action="edit"
                          onClick={() => {
                            setIsEditing(true);
                            setEditId(notice.id);
                            reset({
                              title: notice.title,
                              file: notice.file,
                              created_at: notice.created_at ? notice.created_at.split('T')[0] : '',
                            });
                            setShowForm(true);
                            window.scrollTo({ top: 0, behavior: 'auto' });
                          }}
                        />
                        <DeleteConfirmation
                          onDelete={() => handleDelete(notice.id)}
                          msg={`Are you sure you want to delete "${notice.title}"? This will permanently remove the PDF from storage.`}
                        />
                      </div>
                      <a
                        href={getFileUrl(notice.file)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary flex items-center gap-1 text-[10px] font-bold tracking-tight uppercase hover:underline"
                      >
                        DIRECT Link <ExternalLink size={10} />
                      </a>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default NoticeUploadPage;
