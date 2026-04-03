import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { 
  FiSearch, 
  FiFileText, 
  FiCalendar, 
  FiExternalLink,
  FiX,
  FiPlus
} from "react-icons/fi";
import { 
  Loader2, 
  Inbox,
  List as ListIcon
} from "lucide-react";
import { Loading, PageHeader, StatsCard, SectionCard, ActionButton, DeleteConfirmation } from "@/components";
import { useNotices, useAddNotice, useUpdateNotice, useDeleteNotice } from "@/queries/notice.queries";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { noticeSchema, type NoticeFormData } from "@school/shared-schemas";
import { getFileUrl } from "@/lib/backend";



const NoticeUploadPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
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
    formState: { errors }
  } = useForm<NoticeFormData>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      title: "",
      file: undefined,
      created_at: "",
    },
  });

  const formFile = watch("file");

  const { data: notices = [], isLoading } = useNotices();
  const addMutation = useAddNotice();
  const updateMutation = useUpdateNotice();
  const deleteMutation = useDeleteNotice();

  const isSubmitting = addMutation.isPending || updateMutation.isPending;

  const filteredNotices = useMemo(() => {
    if (!searchQuery) return notices;
    return notices.filter((n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [notices, searchQuery]);

  const onFormSubmit = async (data: NoticeFormData) => {
    if (!isEditing && !data.file) {
      toast.error("Please select a document");
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
      console.error("Error submitting form:", error);
      const message = error instanceof Error ? error.message : "An error occurred";
      toast.error(message);
    }
  };

  const handleCancel = () => {
    reset();
    if (fileref.current) fileref.current.value = "";
    setIsEditing(false);
    setEditId(null);
    setShowForm(false);
  };

  const handleDelete = async (id: string | number) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error("Error deleting notice:", error);
      toast.error("Failed to delete notice");
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Notice Management"
        description="Publish and manage school notices, announcements, and documents."
      >
        <Button
          onClick={() => {
            if (showForm) handleCancel();
            else {
              reset({ title: "", file: undefined, created_at: "" });
              setIsEditing(false);
              setEditId(null);
              setShowForm(true);
              window.scrollTo({ top: 0, behavior: "auto" });
            }
          }}
          className="flex items-center gap-2 px-6 shadow-sm"
        >
          {showForm ? (
            <><FiX className="w-4 h-4" /> Cancel</>
          ) : (
            <><FiPlus className="w-4 h-4" /> Publish Notice</>
          )}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          label="Total Notices"
          value={notices.length}
          loading={isLoading}
          icon={<FiFileText className="w-5 h-5 text-primary" />}
          color="blue"
        />
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <SectionCard className="mb-8 overflow-hidden">
              <h2 className="text-xl font-bold text-foreground mb-6">
                {isEditing ? "Update Notice Info" : "Add New Notice Publication"}
              </h2>

              <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
                <fieldset className="rounded-lg border border-border bg-card p-4 sm:p-5">
                  <legend className="px-2 text-sm sm:text-base font-semibold border-l-2 border-primary">
                    Notice Details
                  </legend>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">Notice Title <span className="text-destructive">*</span></label>
                      <Input
                        id="title"
                        placeholder="e.g. Annual Sports Day 2026 Schedule"
                        {...register("title")}
                        className={`bg-background focus:ring-2 focus:ring-primary/20 transition-all ${errors.title ? 'border-destructive' : ''}`}
                      />
                      {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-muted-foreground">Publish Date (Optional)</label>
                      <Input
                        id="created_at"
                        type="date"
                        {...register("created_at")}
                        className="bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    
                     <div className="space-y-2 md:col-span-2">
                       <label className="block text-sm font-medium text-foreground px-0.5">
                         {isEditing ? "Notice File (PDF)" : "Document (PDF Only) *"}
                       </label>
                       
                       <div 
                         className={`flex items-center justify-between gap-3 p-1.5 rounded-2xl border bg-slate-50/10 min-h-[58px] transition-all ${errors.file ? 'border-destructive' : 'border-slate-200 dark:border-slate-800'}`}
                       >
                         <div className="flex items-center gap-4">
                           <input
                             id="file"
                             type="file"
                             accept=".pdf"
                             ref={fileref}
                             className="hidden"
                             onChange={(e) => setValue("file", e.target.files?.[0] || null, { shouldValidate: true })}
                           />
                           <button
                             type="button"
                             onClick={() => fileref.current?.click()}
                             className="bg-slate-100 dark:bg-slate-800 text-[#2D5BFF] dark:text-[#4A7DFF] hover:bg-slate-200 dark:hover:bg-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shrink-0 whitespace-nowrap ml-1"
                           >
                             Choose File
                           </button>
                           <span className="text-sm text-slate-500 dark:text-slate-400 font-medium truncate max-w-[140px] sm:max-w-md">
                             {formFile instanceof File ? formFile.name : "No file chosen"}
                           </span>
                         </div>

                         {isEditing && typeof formFile === "string" ? (
                           <a
                             href={getFileUrl(formFile)}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="flex items-center gap-2 group px-3 py-1.5 hover:bg-primary/5 rounded-lg transition-colors mr-2"
                           >
                             <FiFileText className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                             <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors hidden sm:inline">
                               Current Notice
                             </span>
                           </a>
                         ) : (
                           <div className="pr-4">
                             <FiFileText className="w-5 h-5 text-slate-400" />
                           </div>
                         )}
                       </div>
                       {errors.file && (
                         <p className="text-xs text-destructive mt-1 font-medium ml-1">{errors.file.message as string}</p>
                       )}
                     </div>
                  </div>
                </fieldset>

                <div className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border pt-4 flex justify-between gap-4">
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
                        <Loader2 className="animate-spin h-4 w-4" />
                        {isEditing ? "Updating..." : "Publishing..."}
                      </span>
                    ) : (
                      isEditing ? "Update Notice" : "Confirm Publication"
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
        icon={<ListIcon className="w-5 h-5" />}
        noPadding
        headerAction={
          <div className="relative w-full max-w-sm">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Search notices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/30 border-transparent focus:bg-background focus:border-border transition-all h-9"
            />
          </div>
        }
      >
        {isLoading ? (
          <div className="p-12"><Loading /></div>
        ) : filteredNotices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground/60 border border-dashed border-border">
              <Inbox size={32} />
            </div>
            <div className="space-y-1 max-w-xs">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">No notices found</h4>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? `No matches found for "${searchQuery}"` : "You haven't published any notices yet."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left p-4 pl-6 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[60%]">Notice Title</th>
                    <th className="text-left p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Published Date</th>
                    <th className="text-right p-4 pr-6 text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <motion.tbody 
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {filteredNotices.map((notice) => (
                    <motion.tr
                      key={notice.id}
                      variants={itemVariants}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors group"
                    >
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-110">
                            <FiFileText size={18} />
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors truncate max-w-md" title={notice.title}>
                            {notice.title}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FiCalendar className="w-4 h-4" />
                          {notice.created_at.split("T")[0]}
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <ActionButton action="view" onClick={() => window.open(getFileUrl(notice.file), "_blank")} />
                          <ActionButton action="edit" onClick={() => {
                             setIsEditing(true);
                             setEditId(notice.id);
                             reset({
                               title: notice.title,
                               file: notice.file,
                               created_at: notice.created_at ? notice.created_at.split("T")[0] : "",
                             });
                             setShowForm(true);
                             window.scrollTo({ top: 0, behavior: "auto" });
                           }} />
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
            <div className="lg:hidden p-4 space-y-4">
              <AnimatePresence>
                {filteredNotices.map((notice) => (
                  <motion.div
                    key={notice.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <FiFileText size={20} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="text-sm font-bold leading-snug line-clamp-2">{notice.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                          <FiCalendar className="w-3 h-3" />
                          {notice.created_at.split("T")[0]}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex gap-1.5">
                        <ActionButton action="view" onClick={() => window.open(notice.file, "_blank")} />
                        <ActionButton action="edit" onClick={() => {
                             setIsEditing(true);
                             setEditId(notice.id);
                             reset({
                               title: notice.title,
                               file: notice.file,
                               created_at: notice.created_at ? notice.created_at.split("T")[0] : "",
                             });
                             setShowForm(true);
                             window.scrollTo({ top: 0, behavior: "auto" });
                           }} />
                        <DeleteConfirmation
                          onDelete={() => handleDelete(notice.id)}
                          msg={`Are you sure you want to delete "${notice.title}"?`}
                        />
                      </div>
                      <a href={notice.file} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-tight hover:underline">
                        DIRECT Link <FiExternalLink size={10} />
                      </a>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </SectionCard>

    </div>
  );
};

export default NoticeUploadPage;
