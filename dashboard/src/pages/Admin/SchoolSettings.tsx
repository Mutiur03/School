import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import axios from "axios";
import { RefreshCw, Save, Loader2, School, Globe, Mail, Phone, MapPin, Palette, Settings } from "lucide-react";
import toast from "react-hot-toast";
import { districts, getUpazilasByDistrict, type District, type Upazila } from "@school/shared-schemas";

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

function SchoolSettings() {
  const [formData, setFormData] = useState<SchoolData>({
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

  const [loading, setLoading] = useState<boolean>(false);
  const [fetching, setFetching] = useState<boolean>(false);

  useEffect(() => {
    fetchSchoolSettings();
  }, []);

  const fetchSchoolSettings = async () => {
    setFetching(true);
    try {
      const res = await axios.get("/api/schools");
      if (res.data?.data && res.data.data.length > 0) {
        // For now, we just take the first school
        setFormData(res.data.data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch school settings:", error);
      toast.error("Failed to load school settings");
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = {
        ...prev,
        [name]: name === "establishedIn" ? parseInt(value) || 0 : value,
      };

      // If district changes, reset upazila
      if (name === "district") {
        newData.upazila = "";
      }

      return newData;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (formData.id) {
        await axios.put(`/api/schools/${formData.id}`, formData);
        toast.success("School settings updated successfully");
      } else {
        await axios.post("/api/schools", formData);
        toast.success("School profile created successfully");
        fetchSchoolSettings();
      }
    } catch (error) {
      console.error("Failed to save school settings:", error);
      toast.error("Failed to save settings");
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
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
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. Dhaka Residential Model College"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Short Name</label>
              <input
                type="text"
                name="shortName"
                value={formData.shortName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. DRMC"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">EIIN Number</label>
              <input
                type="text"
                name="eiin"
                value={formData.eiin}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. 108161"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Slogan</label>
              <input
                type="text"
                name="slogan"
                value={formData.slogan}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. Education, Discipline, Character"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Established In</label>
              <input
                type="number"
                name="establishedIn"
                value={formData.establishedIn}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subdomain</label>
              <div className="flex items-center">
                <input
                  type="text"
                  name="subdomain"
                  value={formData.subdomain}
                  onChange={handleInputChange}
                  className="flex-1 px-3 py-2 border rounded-l-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g. school1"
                />
                <span className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-l-0 rounded-r-lg text-gray-500">
                  .yourdomain.com
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Custom Domain</label>
              <input
                type="text"
                name="customDomain"
                value={formData.customDomain}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="e.g. www.school-one.edu"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 border-b pb-2 dark:border-gray-700">
            <Mail size={18} />
            Contact & Location
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-1">
                <MapPin size={14} /> District
              </label>
              <label className="text-sm font-medium mb-1.5 block">District</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  name="district"
                  value={formData.district}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  required
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
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Upazila</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  name="upazila"
                  value={formData.upazila}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none disabled:opacity-50"
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
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="border-l border-t border-muted-foreground w-2 h-2 rotate-[225deg]"></div>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-1">
                <Phone size={14} /> Phone
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-1">
                <Mail size={14} /> Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 flex items-center gap-1">
                <Globe size={14} /> Website
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="https://example.edu.bd"
              />
            </div>
          </div>
        </div>

        {/* Branding Assets */}
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
                name="logo"
                value={formData.logo}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Favicon URL</label>
              <input
                type="text"
                name="favicon"
                value={formData.favicon}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600"
                placeholder="https://..."
              />
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
            {formData.id ? "Update Settings" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SchoolSettings;
