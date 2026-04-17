import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import {
  RefreshCw,
  Save,
  Loader2,
  School,
  Mail,
  Phone,
  MapPin,
  Palette,
  Settings,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  createSchoolSchema,
  districts,
  getUpazilasByDistrict,
  type District,
  type Upazila,
} from "@school/shared-schemas";

interface SchoolData {
  id?: number;
  name?: string | null;
  shortName?: string | null;
  eiin?: string | null;
  logo?: string | null;
  favicon?: string | null;
  district?: string | null;
  upazila?: string | null;
  phone?: string | null;
  email?: string | null;
  slogan?: string | null;
  establishedIn?: number | null;
  subdomain?: string | null;
  customDomain?: string | null;
}

type SchoolFormValues = z.input<typeof createSchoolSchema>;
// type SchoolFormSubmitValues = z.output<typeof createSchoolSchema>;

const currentYear = new Date().getFullYear();

const createDefaultValues = (): SchoolFormValues => ({
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

function SchoolSettings() {
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetching, setFetching] = useState<boolean>(false);

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
    defaultValues: createDefaultValues(),
    mode: "onSubmit",
        reValidateMode: "onChange",
  });

  const district = watch("district");

  const fetchSchoolSettings = useCallback(async () => {
    setFetching(true);
    try {
      const res = await axios.get("/api/schools/public");
      if (res.data?.data) {
        const school = res.data.data as SchoolData;
        setSchoolId(typeof school.id === "number" ? school.id : null);
        reset(toFormValues(school));
      } else {
        setSchoolId(null);
        reset(createDefaultValues());
      }
    } catch (error) {
      console.error("Failed to fetch school settings:", error);
      toast.error("Failed to load school settings");
    } finally {
      setFetching(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchSchoolSettings();
  }, [fetchSchoolSettings]);

  const onSubmit = async (values: SchoolFormValues) => {
    const result = createSchoolSchema.safeParse(watch());
console.log(result);
    clearErrors();
    setLoading(true);

    try {
      const payload = values;

      if (schoolId) {
        await axios.put(`/api/schools/${schoolId}`, payload);
        toast.success("School settings updated successfully");
      } else {
        const res = await axios.post("/api/schools", payload);
        const createdId = res.data?.data?.id;
        if (typeof createdId === "number") {
          setSchoolId(createdId);
        }
        toast.success("School profile created successfully");
      }

      await fetchSchoolSettings();
    } catch (error) {
      console.error("Failed to save school settings:", error);

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
          toast.error(responseData?.message || "Failed to save settings");
        }
      } else {
        toast.error("Failed to save settings");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <School className="text-primary" />
            School Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your school profile, branding, and contact information
          </p>
        </div>
        <button
          onClick={fetchSchoolSettings}
          disabled={fetching}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 border-b pb-2 dark:border-gray-700">
            <Settings size={18} />
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">School Name</label>
              <input
                type="text"
                {...register("name")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. Dhaka Residential Model College"
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Short Name</label>
              <input
                type="text"
                {...register("shortName")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. DRMC"
              />
              {errors.shortName && <p className="mt-1 text-xs text-red-600">{errors.shortName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">EIIN Number</label>
              <input
                type="text"
                {...register("eiin")}
                inputMode="numeric"
                maxLength={6}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. 123456"
              />
              {errors.eiin && <p className="mt-1 text-xs text-red-600">{errors.eiin.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Slogan</label>
              <input
                type="text"
                {...register("slogan")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. Education, Discipline, Character"
              />
              {errors.slogan && <p className="mt-1 text-xs text-red-600">{errors.slogan.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Established In</label>
              <input
                type="number"
                {...register("establishedIn")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
              />
              {errors.establishedIn && (
                <p className="mt-1 text-xs text-red-600">{errors.establishedIn.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subdomain</label>
              <div className="flex items-center">
                <input
                  type="text"
                  {...register("subdomain")}
                  className="flex-1 px-3 py-2 border rounded-l-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g. school1"
                />
                <span className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-l-0 rounded-r-lg text-gray-500">
                  .yourdomain.com
                </span>
              </div>
              {errors.subdomain && <p className="mt-1 text-xs text-red-600">{errors.subdomain.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Custom Domain</label>
              <input
                type="text"
                {...register("customDomain")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. www.school-one.edu"
              />
              {errors.customDomain && <p className="mt-1 text-xs text-red-600">{errors.customDomain.message}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 border-b pb-2 dark:border-gray-700">
            <Mail size={18} />
            Contact & Location
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">District</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  {...register("district", {
                    onChange: () => {
                      setValue("upazila", "", { shouldValidate: true });
                    },
                  })}
                  className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                >
                  <option value="">Select District</option>
                  {districts.map((d: District) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="border-l border-t border-muted-foreground w-2 h-2 rotate-[225deg]"></div>
                </div>
              </div>
              {errors.district && <p className="mt-1 text-xs text-red-600">{errors.district.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Upazila</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  {...register("upazila")}
                  className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none disabled:opacity-50"
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
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="border-l border-t border-muted-foreground w-2 h-2 rotate-[225deg]"></div>
                </div>
              </div>
              {errors.upazila && <p className="mt-1 text-xs text-red-600">{errors.upazila.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-1">
                <Phone size={14} /> Phone
              </label>
              <input
                type="text"
                {...register("phone")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. 01712345678"
              />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-1">
                <Mail size={14} /> Email
              </label>
              <input
                type="email"
                {...register("email")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. school@example.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 border-b pb-2 dark:border-gray-700">
            <Palette size={18} />
            Branding & Assets
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Logo URL</label>
              <input
                type="text"
                {...register("logo")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="https://..."
              />
              {errors.logo && <p className="mt-1 text-xs text-red-600">{errors.logo.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Favicon URL</label>
              <input
                type="text"
                {...register("favicon")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="https://..."
              />
              {errors.favicon && <p className="mt-1 text-xs text-red-600">{errors.favicon.message}</p>}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Save />}
            {schoolId ? "Update Settings" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SchoolSettings;
