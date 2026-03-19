import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Loader2,
  ArrowLeft,
  Plus,
  Users,
  Calendar,
  Timer,
} from "lucide-react";
import { Card, Button } from "../../components/common";
import clientPortalService from "../../services/clientPortal.service";

const AddOvertime = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    employeeId: "",
    date: "",
    type: "SHIFT_EXTENSION",
    startTime: "",
    endTime: "",
    notes: "",
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await clientPortalService.getActiveEmployees();
        if (res.success) {
          setEmployees(res.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch employees:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    setSuccess("");
  };

  const calculateDuration = () => {
    if (!form.startTime || !form.endTime) return null;
    const [sh, sm] = form.startTime.split(":").map(Number);
    const [eh, em] = form.endTime.split(":").map(Number);
    let diff = eh * 60 + em - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins > 0 ? `${mins}m` : ""}`.trim();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.employeeId) {
      setError("Please select an employee");
      return;
    }
    if (!form.date) {
      setError("Please select a date");
      return;
    }
    if (!form.startTime || !form.endTime) {
      setError("Please enter start and end time");
      return;
    }

    try {
      setSubmitting(true);
      const response = await clientPortalService.createOvertime(form);
      if (response.success) {
        setSuccess("Overtime entry added successfully");
        setForm({
          employeeId: "",
          date: "",
          type: "SHIFT_EXTENSION",
          startTime: "",
          endTime: "",
          notes: "",
        });
      } else {
        setError(response.error || "Failed to add overtime");
      }
    } catch (err) {
      setError(err.error || err.message || "Failed to add overtime");
    } finally {
      setSubmitting(false);
    }
  };

  const duration = calculateDuration();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Add Overtime Entry
          </h2>
          <p className="text-gray-500">
            Schedule overtime for an employee in advance
          </p>
        </div>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5 p-1">
          {/* Employee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Employee
            </label>
            <select
              value={form.employeeId}
              onChange={(e) => handleChange("employeeId", e.target.value)}
              className="input w-full"
            >
              <option value="">Select an employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || "Unknown"}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Calendar className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Date
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => handleChange("date", e.target.value)}
              className="input w-full"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Timer className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Overtime Type
            </label>
            <div className="flex gap-3">
              <label
                className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  form.type === "SHIFT_EXTENSION"
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value="SHIFT_EXTENSION"
                  checked={form.type === "SHIFT_EXTENSION"}
                  onChange={(e) => handleChange("type", e.target.value)}
                  className="sr-only"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Shift Extension
                  </p>
                  <p className="text-xs text-gray-500">Work past shift end</p>
                </div>
              </label>
              <label
                className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  form.type === "OFF_SHIFT"
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value="OFF_SHIFT"
                  checked={form.type === "OFF_SHIFT"}
                  onChange={(e) => handleChange("type", e.target.value)}
                  className="sr-only"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Off-Shift
                  </p>
                  <p className="text-xs text-gray-500">
                    Work outside schedule
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Start / End Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Start Time
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => handleChange("startTime", e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                End Time
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => handleChange("endTime", e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          {/* Duration preview */}
          {duration && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <Timer className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-700">
                Duration: <span className="font-semibold">{duration}</span>
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Reason or notes for this overtime entry..."
              rows={3}
              className="input w-full resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              type="button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              icon={submitting ? Loader2 : Plus}
              className={submitting ? "[&_svg]:animate-spin" : ""}
            >
              {submitting ? "Adding..." : "Add Overtime"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AddOvertime;
