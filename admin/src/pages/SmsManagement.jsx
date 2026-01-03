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
    <div className="p-4 lg:p-6 space-y-6 mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          SMS Management
        </h1>
        <Button onClick={fetchSmsLogs} disabled={loading}>
          <RefreshCw
            className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardContent className="sm:p-6">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">
              Total SMS
            </div>
            <div className="text-lg sm:text-2xl font-bold text-foreground">
              {Object.values(stats).reduce((a, b) => a + b, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="sm:p-6">
            <div className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-500 mb-1 sm:mb-2">
              Sent
            </div>
            <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-500">
              {stats.sent || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="sm:p-6">
            <div className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 mb-1 sm:mb-2">
              Failed
            </div>
            <div className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-500">
              {stats.failed || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="sm:p-6">
            <div className="text-xs sm:text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1 sm:mb-2">
              Pending
            </div>
            <div className="text-lg sm:text-2xl font-bold text-yellow-600 dark:text-yellow-500">
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
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label
                  htmlFor="status-filter"
                  className="text-muted-foreground"
                >
                  Status
                </Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => handleFilterChange("status", value)}
                >
                  <SelectTrigger className="w-full">
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
                <Label htmlFor="date-filter" className="text-muted-foreground">
                  Date
                </Label>
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
                  className="w-full"
                />
              </div>

              <div>
                <Label htmlFor="limit-filter" className="text-muted-foreground">
                  Per Page
                </Label>
                <Select
                  value={filters.limit.toString()}
                  onValueChange={(value) =>
                    handleFilterChange("limit", parseInt(value))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleRetrySelected}
                disabled={retrying || selectedLogs.length === 0}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 flex-1 sm:flex-initial"
              >
                <Send className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Retry Selected</span>
                <span className="sm:hidden">Retry ({selectedLogs.length})</span>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={selectedLogs.length === 0}
                    className="flex-1 sm:flex-initial"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Delete Selected</span>
                    <span className="sm:hidden">
                      Delete ({selectedLogs.length})
                    </span>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-foreground">SMS Logs</CardTitle>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={
                selectedLogs.length === smsLogs.length && smsLogs.length > 0
              }
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Select All
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    <Checkbox
                      checked={
                        selectedLogs.length === smsLogs.length &&
                        smsLogs.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    Student
                  </th>
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    Class Info
                  </th>
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    Phone
                  </th>
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    Date
                  </th>
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    Status
                  </th>
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    SMS count
                  </th>
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    Retry Count
                  </th>
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    Message
                  </th>
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    Error
                  </th>
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {smsLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border hover:bg-muted/50 hover:text-foreground transition-colors group"
                  >
                    <td className="p-3">
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
                    <td className="p-3">
                      <div>
                        <div className="font-medium text-foreground group-hover:text-foreground">
                          {log.student?.name || "N/A"}
                        </div>
                        <div className="text-sm text-muted-foreground group-hover:text-muted-foreground">
                          ID: {log.student?.login_id || "N/A"}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground group-hover:text-muted-foreground">
                      {getStudentInfo(log.student)}
                    </td>
                    <td className="p-3 text-foreground group-hover:text-foreground">
                      {log.phone_number}
                    </td>
                    <td className="p-3 text-foreground group-hover:text-foreground">
                      {formatDateOnly(log.attendance_date)}
                    </td>
                    <td className="p-3">
                      <Badge
                        className={`text-white ${statusColors[log.status]}`}
                      >
                        {statusLabels[log.status]}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {log.sms_count ? (
                        <div className="font-semibold text-sm bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-2 py-1 rounded border border-green-200 dark:border-green-800">
                          {log.sms_count}
                        </div>
                      ) : (
                        <span className="text-muted-foreground group-hover:text-muted-foreground">
                          N/A
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center text-foreground group-hover:text-foreground">
                      {log.retry_count}
                    </td>
                    <td className="p-3 max-w-xs">
                      <div
                        className="truncate text-foreground group-hover:text-foreground"
                        title={log.message}
                      >
                        {log.message}
                      </div>
                    </td>
                    <td className="p-3 max-w-xs">
                      {log.error_reason && (
                        <div
                          className="text-red-600 dark:text-red-400 group-hover:text-red-600 dark:group-hover:text-red-400 text-sm truncate"
                          title={log.error_reason}
                        >
                          {log.error_reason}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground group-hover:text-muted-foreground">
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {smsLogs.map((log) => (
              <Card key={log.id} className="border border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
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
                      <div>
                        <div className="font-medium text-foreground">
                          {log.student?.name || "N/A"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ID: {log.student?.login_id || "N/A"}
                        </div>
                      </div>
                    </div>
                    <Badge className={`text-white ${statusColors[log.status]}`}>
                      {statusLabels[log.status]}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Class Info:</span>
                      <span className="text-foreground">
                        {getStudentInfo(log.student)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="text-foreground">
                        {log.phone_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span className="text-foreground">
                        {formatDateOnly(log.attendance_date)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SMS Count:</span>
                      {log.sms_count ? (
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {log.sms_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Retry Count:
                      </span>
                      <span className="text-foreground">{log.retry_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created:</span>
                      <span className="text-foreground">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    {log.message && (
                      <div className="pt-2">
                        <div className="text-muted-foreground mb-1">
                          Message:
                        </div>
                        <div className="text-foreground text-xs bg-muted p-2 rounded">
                          {log.message}
                        </div>
                      </div>
                    )}
                    {log.error_reason && (
                      <div className="pt-2">
                        <div className="text-muted-foreground mb-1">Error:</div>
                        <div className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/20 p-2 rounded">
                          {log.error_reason}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {smsLogs.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              No SMS logs found matching the current filters.
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-center items-center mt-6 gap-2">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="w-full sm:w-auto"
              >
                Previous
              </Button>

              <span className="flex items-center px-3 py-2 text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                className="w-full sm:w-auto"
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
