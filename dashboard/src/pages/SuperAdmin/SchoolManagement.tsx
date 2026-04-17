import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Building2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import {
  createSchoolSchema,
  districts,
  getUpazilasByDistrict,
  type District,
  type Upazila,
} from "@school/shared-schemas";

interface SchoolData {
  id?: number;
  name: string;
  shortName: string;
  eiin: string;
  logo: string;
  favicon: string;
  district: string;
  upazila: string;
  phone: string;
  email: string;
  slogan: string;
  establishedIn: number;
  subdomain: string;
  customDomain: string;
}

const currentYear = new Date().getFullYear();

type SchoolFormValues = z.input<typeof createSchoolSchema>;

const createEmptySchool = (): SchoolFormValues => ({
  name: "",
  shortName: "",
  eiin: "",
  logo: "",
  favicon: "",
  district: "",
  upazila: "",
  phone: "",
  email: "",
  slogan: "",
  establishedIn: currentYear,
  subdomain: "",
  customDomain: "",
});

const toFormValues = (school?: SchoolData | null): SchoolFormValues => ({
  name: school?.name ?? "",
  shortName: school?.shortName ?? "",
  eiin: school?.eiin ?? "",
  logo: school?.logo ?? "",
  favicon: school?.favicon ?? "",
  district: school?.district ?? "",
  upazila: school?.upazila ?? "",
  phone: school?.phone ?? "",
  email: school?.email ?? "",
  slogan: school?.slogan ?? "",
  establishedIn: school?.establishedIn ?? currentYear,
  subdomain: school?.subdomain ?? "",
  customDomain: school?.customDomain ?? "",
});

function SchoolManagement() {
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | "new">("new");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SchoolFormValues>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: createEmptySchool(),
    mode: "onSubmit",
        reValidateMode: "onChange",
  });

  const district = watch("district");
  const schoolName = watch("name");

  const sortedSchools = useMemo(
    () => [...schools].sort((a, b) => a.name.localeCompare(b.name)),
    [schools],
  );

  const fetchSchools = useCallback(async () => {
    setFetching(true);
    try {
      const res = await axios.get("/api/schools");
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setSchools(list);

      setSelectedSchoolId((previousSelectedId) => {
        if (previousSelectedId === "new") {
          return previousSelectedId;
        }

        const current = list.find(
          (school: SchoolData) => school.id === previousSelectedId,
        );
        if (current) {
          reset(toFormValues(current));
          return previousSelectedId;
        }

        reset(createEmptySchool());
        return "new";
      });
    } catch (error) {
      console.error("Failed to fetch schools", error);
      toast.error("Failed to load schools");
    } finally {
      setFetching(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const selectSchool = (school: SchoolData) => {
    setSelectedSchoolId(school.id ?? "new");
    reset(toFormValues(school));
  };

  const startNewSchool = () => {
    setSelectedSchoolId("new");
    reset(createEmptySchool());
  };

  const onSubmit = async (values: SchoolFormValues) => {
    clearErrors();
    setSaving(true);

    try {
      const payload = values;

      if (selectedSchoolId !== "new") {
        await axios.put(`/api/schools/${selectedSchoolId}`, payload);
        toast.success("School updated successfully");
      } else {
        const res = await axios.post("/api/schools", payload);
        toast.success("School created successfully");

        const createdId = res.data?.data?.id;
        if (typeof createdId === "number") {
          setSelectedSchoolId(createdId);
        }
      }

      await fetchSchools();
    } catch (error) {
      console.error("Failed to save school", error);

      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data as {
          message?: string;
          errors?: Array<{ path?: Array<string | number>; message?: string }>;
        } | undefined;

        const issues = Array.isArray(responseData?.errors)
          ? responseData.errors
          : [];

        let appliedFieldError = false;
        for (const issue of issues) {
          const rawPath = Array.isArray(issue.path)
            ? issue.path.join(".")
            : "";
          const message = issue.message || "Invalid value";

          if (
            rawPath &&
            Object.prototype.hasOwnProperty.call(values, rawPath)
          ) {
            setError(rawPath as keyof SchoolFormValues, {
              type: "server",
              message,
            });
            appliedFieldError = true;
          }
        }

        if (appliedFieldError && issues[0]?.message) {
          toast.error(issues[0].message);
        } else {
          toast.error(responseData?.message || "Failed to save school");
        }
      } else {
        toast.error("Failed to save school");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedSchoolId === "new") return;

    const confirmed = window.confirm(
      `Delete school "${schoolName || "this school"}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await axios.delete(`/api/schools/${selectedSchoolId}`);
      toast.success("School deleted");
      startNewSchool();
      await fetchSchools();
    } catch (error) {
      console.error("Failed to delete school", error);
      toast.error("Failed to delete school");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="text-primary" />
            School Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Create and manage multiple schools from the super admin panel.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSchools}
          disabled={fetching}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Schools ({sortedSchools.length})</h2>
            <button
              type="button"
              onClick={startNewSchool}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          <div className="space-y-2 max-h-130 overflow-y-auto pr-1">
            {sortedSchools.length === 0 && (
              <p className="text-sm text-muted-foreground">No schools found yet.</p>
            )}

            {sortedSchools.map((school) => {
              const isSelected = school.id === selectedSchoolId;
              return (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => selectSchool(school)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium truncate">{school.name || "Untitled School"}</p>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {school.subdomain ? `${school.subdomain}.localhost` : "No subdomain"}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="lg:col-span-8 rounded-xl border bg-card p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {selectedSchoolId !== "new"
                  ? `Edit: ${schoolName || "School"}`
                  : "Create New School"}
              </h2>
              {selectedSchoolId !== "new" && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm text-red-600"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">School Name</label>
                <input
                  {...register("name")}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. Dhaka Residential Model College"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Short Name</label>
                <input
                  {...register("shortName")}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. DRMC"
                />
                {errors.shortName && <p className="mt-1 text-xs text-red-600">{errors.shortName.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">EIIN</label>
                <input
                  {...register("eiin")}
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. 123456"
                />
                {errors.eiin && <p className="mt-1 text-xs text-red-600">{errors.eiin.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Subdomain</label>
                <input
                  {...register("subdomain")}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. lbp"
                />
                {errors.subdomain && <p className="mt-1 text-xs text-red-600">{errors.subdomain.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Custom Domain</label>
                <input
                  {...register("customDomain")}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. school.edu"
                />
                {errors.customDomain && <p className="mt-1 text-xs text-red-600">{errors.customDomain.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">District</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    {...register("district", {
                      onChange: () => {
                        setValue("upazila", "", { shouldValidate: true });
                      },
                    })}
                    className="w-full rounded-md border px-3 py-2 pl-10"
                  >
                    <option value="">Select District</option>
                    {districts.map((d: District) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.district && <p className="mt-1 text-xs text-red-600">{errors.district.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Upazila</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    {...register("upazila")}
                    className="w-full rounded-md border px-3 py-2 pl-10"
                    disabled={!district}
                  >
                    <option value="">Select Upazila</option>
                    {district &&
                      getUpazilasByDistrict(district).map((u: Upazila) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </div>
                {errors.upazila && <p className="mt-1 text-xs text-red-600">{errors.upazila.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1">
                  <Phone className="h-4 w-4" /> Phone
                </label>
                <input
                  {...register("phone")}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. 01712345678"
                />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1">
                  <Mail className="h-4 w-4" /> Email
                </label>
                <input
                  type="email"
                  {...register("email")}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. school@example.com"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Slogan</label>
                <input
                  {...register("slogan")}
                  className="w-full rounded-md border px-3 py-2"
                />
                {errors.slogan && <p className="mt-1 text-xs text-red-600">{errors.slogan.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Established In</label>
                <input
                  type="number"
                  {...register("establishedIn")}
                  className="w-full rounded-md border px-3 py-2"
                />
                {errors.establishedIn && (
                  <p className="mt-1 text-xs text-red-600">{errors.establishedIn.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Logo URL</label>
                <input
                  {...register("logo")}
                  className="w-full rounded-md border px-3 py-2"
                />
                {errors.logo && <p className="mt-1 text-xs text-red-600">{errors.logo.message}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Favicon URL</label>
                <input
                  {...register("favicon")}
                  className="w-full rounded-md border px-3 py-2"
                />
                {errors.favicon && <p className="mt-1 text-xs text-red-600">{errors.favicon.message}</p>}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || deleting}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {selectedSchoolId !== "new" ? "Update School" : "Create School"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default SchoolManagement;
