import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "react-hot-toast";
import { RefreshCw, Send, Trash2, Filter, Eye, Download } from "lucide-react";
import Loading from "../components/Loading";

function SmsManagement() {
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const formatDateOnly = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  
  const convertToISODate = (ddmmyyyy) => {
    if (!ddmmyyyy) return "";
    const parts = ddmmyyyy.split("/");
    if (parts.length !== 3) return ddmmyyyy; 
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };


  const [smsLogs, setSmsLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: "all",
    date: formatDateOnly(new Date().toISOString()),
    limit: 50,
  });

  const statusColors = {
    sent: "bg-green-500",
    failed: "bg-red-500",
    pending: "bg-yellow-500",
  };

  const statusLabels = {
    sent: "Sent",
    failed: "Failed",
    pending: "Pending",
  };

  const fetchSmsLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: filters.limit,
        ...filters,
        date: convertToISODate(filters.date), 
      });

      const response = await axios.get(`/api/sms/sms-logs?${params}`);
      setSmsLogs(response.data.smsLogs);
      setTotalPages(response.data.totalPages);
      setStats(response.data.stats);
    } catch (error) {
      console.error("Error fetching SMS logs:", error);
      toast.error("Failed to fetch SMS logs");
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters]);

  useEffect(() => {
    fetchSmsLogs();

    const fetchSmsStats = async () => {
      try {
        await axios.get("/api/sms/sms-stats");
        
      } catch (error) {
        console.error("Error fetching SMS stats:", error);
      }
    };
    fetchSmsStats();
  }, [currentPage, filters, fetchSmsLogs]);

  const handleRetrySelected = async () => {
    if (selectedLogs.length === 0) {
      toast.error("Please select SMS logs to retry");
      return;
    }

    const failedLogs = smsLogs.filter(
      (log) => selectedLogs.includes(log.id) && log.status === "failed"
    );

    if (failedLogs.length === 0) {
      toast.error("Please select only failed SMS logs for retry");
      return;
    }

    try {
      setRetrying(true);
      const response = await axios.post("/api/sms/retry-sms", {
        smsLogIds: failedLogs.map((log) => log.id),
      });

      toast.success(response.data.message);
      setSelectedLogs([]);
      fetchSmsLogs();
    } catch (error) {
      console.error("Error retrying SMS:", error);
      toast.error("Failed to retry SMS messages");
    } finally {
      setRetrying(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLogs.length === 0) {
      toast.error("Please select SMS logs to delete");
      return;
    }

    try {
      const response = await axios.delete("/api/sms/sms-logs", {
        data: { smsLogIds: selectedLogs },
      });

      toast.success(response.data.message);
      setSelectedLogs([]);
      fetchSmsLogs();
    } catch (error) {
      console.error("Error deleting SMS logs:", error);
      toast.error("Failed to delete SMS logs");
    }
  };

  const handleSelectAll = () => {
    if (selectedLogs.length === smsLogs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(smsLogs.map((log) => log.id));
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const getStudentInfo = (student) => {
    if (!student || !student.enrollments || student.enrollments.length === 0) {
      return "N/A";
    }
    const enrollment = student.enrollments[0];
    return `Class ${enrollment.class}, Section ${enrollment.section}, Roll ${enrollment.roll}`;
  };

  if (loading && smsLogs.length === 0) {
    return <Loading />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">SMS Management</h1>
        <Button onClick={fetchSmsLogs} disabled={loading}>
          <RefreshCw
            className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total SMS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(stats).reduce((a, b) => a + b, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.sent || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.failed || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pending || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date-filter">Date</Label>
              <Input
                id="date-filter"
                type="text"
                placeholder="dd/mm/yyyy"
                value={filters.date}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, ""); 
                  if (value.length >= 2)
                    value = value.slice(0, 2) + "/" + value.slice(2);
                  if (value.length >= 5)
                    value = value.slice(0, 5) + "/" + value.slice(5, 9);
                  handleFilterChange("date", value);
                }}
                maxLength={10}
                className="w-[150px]"
              />
            </div>

            <div>
              <Label htmlFor="limit-filter">Per Page</Label>
              <Select
                value={filters.limit.toString()}
                onValueChange={(value) =>
                  handleFilterChange("limit", parseInt(value))
                }
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 ml-auto">
              <Button
                onClick={handleRetrySelected}
                disabled={retrying || selectedLogs.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Retry Selected
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={selectedLogs.length === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete SMS Logs</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedLogs.length}{" "}
                      selected SMS log(s)? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteSelected}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMS Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>SMS Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">
                    <Checkbox
                      checked={
                        selectedLogs.length === smsLogs.length &&
                        smsLogs.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left p-2">Student</th>
                  <th className="text-left p-2">Class Info</th>
                  <th className="text-left p-2">Phone</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Retry Count</th>
                  <th className="text-left p-2">Message</th>
                  <th className="text-left p-2">Error</th>
                  <th className="text-left p-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {smsLogs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <Checkbox
                        checked={selectedLogs.includes(log.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLogs((prev) => [...prev, log.id]);
                          } else {
                            setSelectedLogs((prev) =>
                              prev.filter((id) => id !== log.id)
                            );
                          }
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <div>
                        <div className="font-medium">
                          {log.student?.name || "N/A"}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {log.student?.login_id || "N/A"}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-sm">
                      {getStudentInfo(log.student)}
                    </td>
                    <td className="p-2">{log.phone_number}</td>
                    <td className="p-2">
                      {formatDateOnly(log.attendance_date)}
                    </td>
                    <td className="p-2">
                      <Badge
                        className={`text-white ${statusColors[log.status]}`}
                      >
                        {statusLabels[log.status]}
                      </Badge>
                    </td>
                    <td className="p-2 text-center">{log.retry_count}</td>
                    <td className="p-2 max-w-xs">
                      <div className="truncate" title={log.message}>
                        {log.message}
                      </div>
                    </td>
                    <td className="p-2 max-w-xs">
                      {log.error_reason && (
                        <div
                          className="text-red-600 text-sm truncate"
                          title={log.error_reason}
                        >
                          {log.error_reason}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-sm">
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {smsLogs.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                No SMS logs found matching the current filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-4 space-x-2">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>

              <span className="flex items-center px-3 py-2">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SmsManagement;
