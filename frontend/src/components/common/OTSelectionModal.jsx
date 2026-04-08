import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { formatHours } from "../../utils/formatDateTime";

const formatClockTime = (dateStr, tz) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
};

const OTSelectionModal = ({
  isOpen,
  onClose,
  action = "approve",
  entries = [],
  clientTimezone,
  onConfirm,
  actionLoading = false,
}) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [rejectReason, setRejectReason] = useState("");

  // Reset state when modal opens with new entries
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(entries.map((ot) => ot.id));
      setRejectReason("");
    }
  }, [isOpen, entries]);

  const toggleSelection = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    if (selectedIds.length === 0) return;
    if (action === "reject" && !rejectReason.trim()) return;
    const uniqueIds = [...new Set(selectedIds)];
    onConfirm(uniqueIds, action === "reject" ? rejectReason.trim() : null);
  };

  if (!isOpen) return null;

  // Group OT entries by session (date + clockIn/clockOut)
  const sessionMap = new Map();
  entries.forEach((ot) => {
    const sessionKey = `${ot._date || "unknown"}_${ot._clockIn || ""}_${ot._clockOut || ""}`;
    if (!sessionMap.has(sessionKey)) {
      sessionMap.set(sessionKey, {
        date: ot._date,
        clockIn: ot._clockIn,
        clockOut: ot._clockOut,
        empName: ot._empName,
        entries: [],
      });
    }
    sessionMap.get(sessionKey).entries.push(ot);
  });
  const sessions = Array.from(sessionMap.values());
  const tz = clientTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {action === "approve" ? "Approve Overtime" : "Reject Overtime"}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Select the overtime entries to {action}:
        </p>
        <div className="space-y-4 mb-4">
          {sessions.map((session, sIdx) => (
            <div key={sIdx}>
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-600 font-medium flex-wrap">
                <span>
                  {session.date
                    ? new Date(session.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })
                    : "—"}
                </span>
                {session.empName && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span>{session.empName}</span>
                  </>
                )}
                <span className="text-gray-400">•</span>
                <span>
                  Clock In:{" "}
                  {session.clockIn ? formatClockTime(session.clockIn, tz) : "—"}
                </span>
                <span className="text-gray-400">•</span>
                <span>
                  Clock Out:{" "}
                  {session.clockOut
                    ? formatClockTime(session.clockOut, tz)
                    : "—"}
                </span>
              </div>
              <div className="space-y-2">
                {session.entries.map((ot) => (
                  <label
                    key={ot.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedIds.includes(ot.id)
                        ? action === "approve"
                          ? "border-green-300 bg-green-50"
                          : "border-red-300 bg-red-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(ot.id)}
                      onChange={() => toggleSelection(ot.id)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">
                          {formatHours(ot.requestedMinutes / 60)}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            ot.type === "SHIFT_EXTENSION"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {ot.type === "SHIFT_EXTENSION"
                            ? "Shift Extension"
                            : "Off-Shift"}
                        </span>
                      </div>
                      {ot.reason && (
                        <p className="text-xs text-gray-500 mt-0.5 break-words">
                          {ot.reason}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {action === "reject" && (
          <div className="mb-4">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              actionLoading ||
              selectedIds.length === 0 ||
              (action === "reject" && !rejectReason.trim())
            }
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2 ${
              action === "approve"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {action === "approve"
              ? `Approve (${selectedIds.length})`
              : `Reject (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OTSelectionModal;
