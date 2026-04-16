import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
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
  website: string;
  slogan: string;
  establishedIn: number;
  subdomain: string;
  customDomain: string;
}

const createEmptySchool = (): SchoolData => ({
  name: "",
  shortName: "",
  eiin: "",
  logo: "",
  favicon: "",
  district: "",
  upazila: "",
  phone: "",
  email: "",
  website: "",
  slogan: "",
  establishedIn: new Date().getFullYear(),
  subdomain: "",
  customDomain: "",
});

function SchoolManagement() {
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [formData, setFormData] = useState<SchoolData>(createEmptySchool());
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | "new">("new");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const sortedSchools = useMemo(
    () => [...schools].sort((a, b) => a.name.localeCompare(b.name)),
    [schools],
  );

  const fetchSchools = async () => {
    setFetching(true);
    try {
      const res = await axios.get("/api/schools");
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setSchools(list);

      if (selectedSchoolId === "new") {
        return;
      }

      const current = list.find((school: SchoolData) => school.id === selectedSchoolId);
      if (current) {
        setFormData(current);
      } else {
        setSelectedSchoolId("new");
        setFormData(createEmptySchool());
      }
    } catch (error) {
      console.error("Failed to fetch schools", error);
      toast.error("Failed to load schools");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const selectSchool = (school: SchoolData) => {
    setSelectedSchoolId(school.id ?? "new");
    setFormData({ ...school });
  };

  const startNewSchool = () => {
    setSelectedSchoolId("new");
    setFormData(createEmptySchool());
  };

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: name === "establishedIn" ? parseInt(value, 10) || 0 : value,
      };

      if (name === "district") {
        next.upazila = "";
      }

      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (formData.id) {
        await axios.put(`/api/schools/${formData.id}`, formData);
        toast.success("School updated successfully");
      } else {
        const res = await axios.post("/api/schools", formData);
        toast.success("School created successfully");

        const createdId = res.data?.data?.id;
        if (typeof createdId === "number") {
          setSelectedSchoolId(createdId);
        }
      }

      await fetchSchools();
    } catch (error) {
      console.error("Failed to save school", error);
      toast.error("Failed to save school");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!formData.id) return;

    const confirmed = window.confirm(
      `Delete school \"${formData.name}\"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await axios.delete(`/api/schools/${formData.id}`);
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
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {formData.id ? `Edit: ${formData.name || "School"}` : "Create New School"}
              </h2>
              {formData.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm text-red-600"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">School Name</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. Dhaka Residential Model College"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Short Name</label>
                <input
                  name="shortName"
                  value={formData.shortName}
                  onChange={handleInputChange}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. DRMC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">EIIN</label>
                <input
                  name="eiin"
                  value={formData.eiin}
                  onChange={handleInputChange}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. 108161"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Subdomain</label>
                <input
                  name="subdomain"
                  value={formData.subdomain}
                  onChange={handleInputChange}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. lbp"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Custom Domain</label>
                <input
                  name="customDomain"
                  value={formData.customDomain}
                  onChange={handleInputChange}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="e.g. school.edu"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">District</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    name="district"
                    value={formData.district}
                    onChange={handleInputChange}
                    className="w-full rounded-md border px-3 py-2 pl-10"
                    required
                  >
                    <option value="">Select District</option>
                    {districts.map((d: District) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Upazila</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    name="upazila"
                    value={formData.upazila}
                    onChange={handleInputChange}
                    className="w-full rounded-md border px-3 py-2 pl-10"
                    required
                    disabled={!formData.district}
                  >
                    <option value="">Select Upazila</option>
                    {formData.district &&
                      getUpazilasByDistrict(formData.district).map((u: Upazila) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1">
                  <Phone className="h-4 w-4" /> Phone
                </label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full rounded-md border px-3 py-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1">
                  <Mail className="h-4 w-4" /> Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full rounded-md border px-3 py-2"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Website</label>
                <input
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="https://example.edu.bd"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Slogan</label>
                <input
                  name="slogan"
                  value={formData.slogan}
                  onChange={handleInputChange}
                  className="w-full rounded-md border px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Established In</label>
                <input
                  type="number"
                  name="establishedIn"
                  value={formData.establishedIn}
                  onChange={handleInputChange}
                  className="w-full rounded-md border px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Logo URL</label>
                <input
                  name="logo"
                  value={formData.logo}
                  onChange={handleInputChange}
                  className="w-full rounded-md border px-3 py-2"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Favicon URL</label>
                <input
                  name="favicon"
                  value={formData.favicon}
                  onChange={handleInputChange}
                  className="w-full rounded-md border px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || deleting}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {formData.id ? "Update School" : "Create School"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default SchoolManagement;