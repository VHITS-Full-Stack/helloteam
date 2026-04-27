import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Coffee,
  Sun,
  Moon,
  Sunrise,
  Target,
  Zap,
  Users,
  MessageSquare,
  Video,
  Bell,
  Heart,
  Award,
  Sparkles,
  ChevronRight,
  Play,
  Pause,
  Square,
  RefreshCw,
  Wifi,
  Monitor,
  Headphones,
  Star,
  Quote,
  Lightbulb,
  ClockIcon,
  X,
  StickyNote,
  Loader2,
  Check,
  DollarSign,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
} from "../../components/common";
import workSessionService from "../../services/workSession.service";
import overtimeService from "../../services/overtime.service";
import scheduleService from "../../services/schedule.service";
import taskService from "../../services/task.service";
import chatService from "../../services/chat.service";
import payrollService from "../../services/payroll.service";
import {
  playClockInSound,
  playClockOutSound,
  playBreakStartSound,
  playBreakEndSound,
} from "../../utils/sounds";
import { formatTime12, formatDuration } from "../../utils/formatDateTime";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Work session state
  const [sessionData, setSessionData] = useState(null);
  const [, setTodaySummary] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [clockOutTime, setClockOutTime] = useState(null);
  const [error, setError] = useState(null);

  // Overtime request modal state
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeForm, setOvertimeForm] = useState({
    type: "SHIFT_EXTENSION",
    date: new Date().toISOString().split("T")[0],
    requestedHours: "",
    requestedStartTime: "",
    requestedEndTime: "",
    durationHours: "",
    reason: "",
  });
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [overtimeError, setOvertimeError] = useState("");
  const [overtimeSuccess, setOvertimeSuccess] = useState("");

  // Resolve client timezone
  const clientTz = sessionData?.clientTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Shift extension state (driven by session data)
  const [isInExtension, setIsInExtension] = useState(false);

  // My overtime requests state
  const [myOvertimeRequests, setMyOvertimeRequests] = useState([]);
  const [overtimeRequestsLoading, setOvertimeRequestsLoading] = useState(false);

  // Tasks state
  const [todayTasks, setTodayTasks] = useState([]);
  const [totalTaskCount, setTotalTaskCount] = useState(0);
  const [doneTaskCount, setDoneTaskCount] = useState(0);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Unread messages count
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Next payroll date state
  const [nextPayrollDate, setNextPayrollDate] = useState(null);

  // Clock-in warning states
  const [showPostShiftWarning, setShowPostShiftWarning] = useState(false);
  const [showEarlyClockInWarning, setShowEarlyClockInWarning] = useState(false);
  const [showLateClockInWarning, setShowLateClockInWarning] = useState(false);
  const [showLateArrivalWarning, setShowLateArrivalWarning] = useState(false);
  const [showUnscheduledDayWarning, setShowUnscheduledDayWarning] =
    useState(false);
  const [clockInWarningMessage, setClockInWarningMessage] = useState("");
  const [weekSchedule, setWeekSchedule] = useState([]);

  // Coming soon toast
  const [showComingSoon, setShowComingSoon] = useState(false);
  const comingSoonTimeoutRef = useRef(null);

  const [toastMessage, setToastMessage] = useState(null);

  const triggerComingSoon = () => {
    setToastMessage({
      title: "Coming Soon",
      description: "This feature is under development.",
    });
    setShowComingSoon(true);
    if (comingSoonTimeoutRef.current)
      clearTimeout(comingSoonTimeoutRef.current);
    comingSoonTimeoutRef.current = setTimeout(
      () => setShowComingSoon(false),
      3000,
    );
  };

  const triggerNoConversations = () => {
    setToastMessage({
      title: "No Messages",
      description: "No conversations yet.",
    });
    setShowComingSoon(true);
    if (comingSoonTimeoutRef.current)
      clearTimeout(comingSoonTimeoutRef.current);
    comingSoonTimeoutRef.current = setTimeout(
      () => setShowComingSoon(false),
      3000,
    );
  };

  // Activity notes state
  const [activityNotes, setActivityNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesLastSaved, setNotesLastSaved] = useState(null);
  const notesTimeoutRef = useRef(null);

  // Motivational quotes
  const quotes = [
    {
      text: "The only way to do great work is to love what you do.",
      author: "Steve Jobs",
    },
    {
      text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
      author: "Winston Churchill",
    },
    {
      text: "Believe you can and you're halfway there.",
      author: "Theodore Roosevelt",
    },
    {
      text: "The future belongs to those who believe in the beauty of their dreams.",
      author: "Eleanor Roosevelt",
    },
    {
      text: "Excellence is not a destination but a continuous journey that never ends.",
      author: "Brian Tracy",
    },
    {
      text: "Your talent determines what you can do. Your motivation determines how much you're willing to do.",
      author: "Lou Holtz",
    },
    {
      text: "The secret of getting ahead is getting started.",
      author: "Mark Twain",
    },
  ];

  // Fetch overtime requests
  const fetchingOvertimeRef = useRef(false);
  const fetchOvertimeRequests = useCallback(async () => {
    if (fetchingOvertimeRef.current) return;
    fetchingOvertimeRef.current = true;
    try {
      setOvertimeRequestsLoading(true);
      const response = await overtimeService.getOvertimeRequests({ limit: 5 });
      if (response.success) {
        setMyOvertimeRequests(response.data.requests || []);
      }
    } catch (err) {
      console.error("Failed to fetch overtime requests:", err);
    } finally {
      setOvertimeRequestsLoading(false);
      fetchingOvertimeRef.current = false;
    }
  }, []);

  // Fetch tasks (personal + client-assigned)
  const fetchingTasksRef = useRef(false);
  const fetchTasks = useCallback(async () => {
    if (fetchingTasksRef.current) return;
    fetchingTasksRef.current = true;
    try {
      setTasksLoading(true);
      const [personalRes, clientRes, doneRes] = await Promise.all([
        taskService.getTasks({ limit: 5, isPersonal: "true" }),
        taskService.getTasks({ limit: 5, isPersonal: "false" }),
        taskService.getTasks({ limit: 1, status: "DONE" }),
      ]);
      if (personalRes.success && clientRes.success) {
        const combined = [...(personalRes.data.tasks || []), ...(clientRes.data.tasks || [])];
        setTodayTasks(combined.slice(0, 5));
        const totalPersonal = personalRes.data.pagination?.total || 0;
        const totalClient = clientRes.data.pagination?.total || 0;
        setTotalTaskCount(totalPersonal + totalClient);
      }
      if (doneRes.success) {
        setDoneTaskCount(doneRes.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setTasksLoading(false);
      fetchingTasksRef.current = false;
    }
  }, []);

  // Fetch unread message count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await chatService.getUnreadCount();
      if (res.success) {
        setUnreadMessageCount(res.data?.count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  }, []);

  // Fetch next payroll date
  const fetchNextPayrollDate = useCallback(async () => {
    try {
      const res = await payrollService.getCurrentPeriod();
      if (res.success && res.data) {
        setNextPayrollDate(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch payroll date:", err);
    }
  }, []);

  // Save activity notes
  const saveNotes = useCallback(
    async (notesText) => {
      if (!sessionData?.session) return;

      setNotesSaving(true);
      try {
        const response = await workSessionService.updateNotes(notesText);
        if (response.success) {
          setNotesLastSaved(new Date());
        }
      } catch (error) {
        console.error("Failed to save notes:", error);
      } finally {
        setNotesSaving(false);
      }
    },
    [sessionData?.session],
  );

  // Handle notes change with debounced auto-save
  const handleNotesChange = (e) => {
    const newNotes = e.target.value;
    setActivityNotes(newNotes);

    // Clear existing timeout
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }

    // Set new timeout for auto-save (1.5 seconds after typing stops)
    notesTimeoutRef.current = setTimeout(() => {
      saveNotes(newNotes);
    }, 1500);
  };

  // Load notes from session when session data changes
  useEffect(() => {
    if (sessionData?.session?.notes !== undefined) {
      setActivityNotes(sessionData.session.notes || "");
    }
  }, [sessionData?.session?.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, []);

  // Fetch work session data
  const fetchingSessionRef = useRef(false);
  const fetchWorkSessionData = useCallback(async () => {
    if (fetchingSessionRef.current) return;
    fetchingSessionRef.current = true;
    try {
      // Use Promise.allSettled to handle partial failures gracefully
      const [sessionResult, todayResult, weeklyResult] =
        await Promise.allSettled([
          workSessionService.getCurrentSession(),
          workSessionService.getTodaySummary(),
          workSessionService.getWeeklySummary(),
        ]);

      // Handle session data
      if (sessionResult.status === "fulfilled") {
        setSessionData(sessionResult.value);
      } else {
        console.error("Failed to fetch current session:", sessionResult.reason);
      }

      // Handle today summary
      if (todayResult.status === "fulfilled" && todayResult.value?.summary) {
        setTodaySummary(todayResult.value.summary);
      } else if (todayResult.status === "rejected") {
        console.error("Failed to fetch today summary:", todayResult.reason);
      }

      // Handle weekly summary
      if (weeklyResult.status === "fulfilled" && weeklyResult.value?.summary) {
        setWeeklySummary(weeklyResult.value.summary);
      } else if (weeklyResult.status === "rejected") {
        console.error("Failed to fetch weekly summary:", weeklyResult.reason);
      }

      setError(null);
    } catch (err) {
      console.error("Failed to fetch work session data:", err);
      // Don't show error on dashboard, just use defaults
    } finally {
      setIsLoading(false);
      fetchingSessionRef.current = false;
    }
  }, []);

  // Fetch this week's schedule (Sunday start — same as Schedule page)
  const fetchWeekSchedule = useCallback(async () => {
    try {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
      const y = startOfWeek.getFullYear();
      const m = String(startOfWeek.getMonth() + 1).padStart(2, "0");
      const d = String(startOfWeek.getDate()).padStart(2, "0");
      const weekStartStr = `${y}-${m}-${d}`;
      const res = await scheduleService.getMySchedule(weekStartStr);
      if (res.success && res.schedule) {
        setWeekSchedule(res.schedule);
      }
    } catch (err) {
      console.error("Failed to fetch week schedule:", err);
    }
  }, []);

  useEffect(() => {
    fetchWorkSessionData();
    fetchOvertimeRequests();
    fetchTasks();
    fetchUnreadCount();
    fetchWeekSchedule();
    fetchNextPayrollDate();
  }, [
    fetchWorkSessionData,
    fetchOvertimeRequests,
    fetchTasks,
    fetchUnreadCount,
    fetchWeekSchedule,
    fetchNextPayrollDate,
  ]);

  // Detect if session is in extension mode (resumed after shift end)
  useEffect(() => {
    const session = sessionData?.session;
    if (
      session &&
      session.shiftEndResumedAt &&
      session.status !== "COMPLETED"
    ) {
      setIsInExtension(true);
    }
  }, [sessionData?.session?.id, sessionData?.session?.shiftEndResumedAt]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Change quote every 30 seconds
  useEffect(() => {
    const quoteTimer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 30000);
    return () => clearInterval(quoteTimer);
  }, []);

  const formatDurationWithSeconds = (startTime, breaks) => {
    if (!startTime) return "00:00:00";
    const start = new Date(startTime);
    const now = clockOutTime || new Date();
    let breakSeconds = 0;
    if (breaks && breaks.length > 0) {
      for (const brk of breaks) {
        const brkStart = new Date(brk.startTime);
        if (brk.endTime) {
          breakSeconds += Math.floor(
            (new Date(brk.endTime).getTime() - brkStart.getTime()) / 1000,
          );
        } else {
          // Ongoing break — count time so far
          breakSeconds += Math.floor(
            (now.getTime() - brkStart.getTime()) / 1000,
          );
        }
      }
    }
    const totalSeconds = Math.max(
      0,
      Math.floor((now.getTime() - start.getTime()) / 1000) - breakSeconds,
    );
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: "Good Morning", icon: Sunrise, emoji: "☀️" };
    if (hour < 17) return { text: "Good Afternoon", icon: Sun, emoji: "🌤️" };
    return { text: "Good Evening", icon: Moon, emoji: "🌙" };
  };

  const greeting = getGreeting();

  // Handle clock in
  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      const response = await workSessionService.clockIn();
      if (response.requiresConfirmation) {
        setClockInWarningMessage(response.message || "");
        if (response.confirmationType === "EARLY_CLOCK_IN") {
          setShowEarlyClockInWarning(true);
        } else if (response.confirmationType === "LATE_ARRIVAL") {
          setShowLateArrivalWarning(true);
        } else if (response.confirmationType === "LATE_CLOCK_IN") {
          setShowLateClockInWarning(true);
        } else if (response.confirmationType === "UNSCHEDULED_DAY") {
          setShowUnscheduledDayWarning(true);
        } else {
          setShowPostShiftWarning(true);
        }
        return;
      }
      playClockInSound();
      await fetchWorkSessionData();
    } catch (err) {
      setError(err.message || "Failed to clock in");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle confirmed early clock-in (employee acknowledged the warning)
  const handleEarlyClockIn = async () => {
    try {
      setActionLoading(true);
      setShowEarlyClockInWarning(false);
      await workSessionService.clockIn({ confirmEarlyClockIn: true });
      playClockInSound();
      await fetchWorkSessionData();
    } catch (err) {
      setError(err.message || "Failed to clock in");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle confirmed post-shift clock-in (employee acknowledged the warning)
  const handlePostShiftClockIn = async () => {
    try {
      setActionLoading(true);
      setShowPostShiftWarning(false);
      await workSessionService.clockIn({ confirmPostShift: true });
      playClockInSound();
      await fetchWorkSessionData();
    } catch (err) {
      setError(err.message || "Failed to clock in");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle confirmed late clock-in (employee acknowledged the warning - after shift end)
  const handleLateClockIn = async () => {
    try {
      setActionLoading(true);
      setShowLateClockInWarning(false);
      await workSessionService.clockIn({ confirmPostShift: true });
      playClockInSound();
      await fetchWorkSessionData();
    } catch (err) {
      setError(err.message || "Failed to clock in");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle confirmed unscheduled day clock-in (extra time)
  const handleUnscheduledDayClockIn = async () => {
    try {
      setActionLoading(true);
      setShowUnscheduledDayWarning(false);
      await workSessionService.clockIn({ confirmUnscheduledDay: true });
      playClockInSound();
      await fetchWorkSessionData();
    } catch (err) {
      setError(err.message || "Failed to clock in");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle confirmed late arrival clock-in (employee acknowledged the warning - after shift start)
  const handleLateArrivalClockIn = async () => {
    try {
      setActionLoading(true);
      setShowLateArrivalWarning(false);
      await workSessionService.clockIn({ confirmLateArrival: true });
      playClockInSound();
      await fetchWorkSessionData();
    } catch (err) {
      setError(err.message || "Failed to clock in");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle clock out
  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      setClockOutTime(new Date());
      await workSessionService.clockOut();
      playClockOutSound();
      await fetchWorkSessionData();
    } catch (err) {
      setError(err.message || "Failed to clock out");
      setClockOutTime(null);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle start break
  const handleStartBreak = async () => {
    try {
      setActionLoading(true);
      await workSessionService.startBreak();
      playBreakStartSound();
      await fetchWorkSessionData();
    } catch (err) {
      setError(err.message || "Failed to start break");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle end break
  const handleEndBreak = async () => {
    try {
      setActionLoading(true);
      await workSessionService.endBreak();
      playBreakEndSound();
      await fetchWorkSessionData();
    } catch (err) {
      setError(err.message || "Failed to end break");
    } finally {
      setActionLoading(false);
    }
  };

  // Get today's scheduled shift end time from weekSchedule
  const getTodayShiftEndTime = () => {
    const now = new Date();
    const todayDow = now.getDay(); // 0-6, matches weekSchedule dayOfWeek
    const todaySchedule = weekSchedule.find((s) => s.dayOfWeek === todayDow);
    if (todaySchedule && todaySchedule.isScheduled && todaySchedule.endTime) {
      return todaySchedule.endTime; // "HH:MM" format
    }
    return null;
  };

  // Calculate end time from shift end + duration for SHIFT_EXTENSION
  const getCalculatedEndTime = () => {
    const shiftEnd = getTodayShiftEndTime();
    if (!shiftEnd) return null;
    const mins = parseInt(overtimeForm.durationHours) || 0;
    if (mins === 0) return null;
    const [endH, endM] = shiftEnd.split(":").map(Number);
    const totalMinutes = endH * 60 + endM + mins;
    const calcH = Math.floor(totalMinutes / 60) % 24;
    const calcM = totalMinutes % 60;
    return `${String(calcH).padStart(2, "0")}:${String(calcM).padStart(2, "0")}`;
  };

  // Handle overtime request submission
  const handleOvertimeSubmit = async (e) => {
    e.preventDefault();
    setOvertimeError("");
    setOvertimeSuccess("");

    const todayStr = new Date().toISOString().split("T")[0];
    if (!overtimeForm.date || !overtimeForm.reason) {
      setOvertimeError("Please fill in all required fields");
      return;
    }
    // Enforce same-day requests: date must be today
    if (overtimeForm.date !== todayStr) {
      setOvertimeError("Overtime requests must be for today only");
      return;
    }
    if (overtimeForm.type === "SHIFT_EXTENSION") {
      const shiftEnd = getTodayShiftEndTime();
      if (!shiftEnd) {
        setOvertimeError("No scheduled shift found for today");
        return;
      }
      const durMins = parseInt(overtimeForm.durationHours) || 0;
      if (durMins === 0) {
        setOvertimeError("Please enter the overtime duration");
        return;
      }
      // Set start/end times from shift end + duration
      overtimeForm.requestedStartTime = shiftEnd;
      overtimeForm.requestedEndTime = getCalculatedEndTime();
    }

    if (
      overtimeForm.type === "OFF_SHIFT" &&
      (!overtimeForm.requestedStartTime || !overtimeForm.requestedEndTime)
    ) {
      setOvertimeError("Please enter start and end times");
      return;
    }

    // Validate OFF_SHIFT times are outside schedule
    if (
      overtimeForm.type === "OFF_SHIFT" &&
      overtimeForm.requestedStartTime &&
      overtimeForm.requestedEndTime
    ) {
      try {
        const selectedDate = new Date(overtimeForm.date + "T00:00:00");
        const dayOfWeek = selectedDate.getDay(); // 0-6
        // Calculate week start (Sunday) for the selected date
        const weekStart = new Date(selectedDate);
        weekStart.setDate(selectedDate.getDate() - dayOfWeek);
        const weekStartStr = weekStart.toISOString().split("T")[0];

        const schedRes = await scheduleService.getMySchedule(weekStartStr);
        if (schedRes.success && schedRes.schedule) {
          const daySchedule = schedRes.schedule.find(
            (s) => s.dayOfWeek === dayOfWeek,
          );
          if (
            daySchedule &&
            daySchedule.isScheduled &&
            daySchedule.startTime &&
            daySchedule.endTime
          ) {
            const [schedStartH, schedStartM] = daySchedule.startTime
              .split(":")
              .map(Number);
            const [schedEndH, schedEndM] = daySchedule.endTime
              .split(":")
              .map(Number);
            const schedStartMin = schedStartH * 60 + schedStartM;
            const schedEndMin = schedEndH * 60 + schedEndM;

            const [reqStartH, reqStartM] = overtimeForm.requestedStartTime
              .split(":")
              .map(Number);
            const [reqEndH, reqEndM] = overtimeForm.requestedEndTime
              .split(":")
              .map(Number);
            const reqStartMin = reqStartH * 60 + reqStartM;
            const reqEndMin = reqEndH * 60 + reqEndM;

            // Check overlap: reqStart < schedEnd AND reqEnd > schedStart
            if (reqStartMin < schedEndMin && reqEndMin > schedStartMin) {
              setOvertimeError(
                `The requested time overlaps with your scheduled shift (${formatTime12(daySchedule.startTime)} – ${formatTime12(daySchedule.endTime)}). Off-shift overtime must be outside your schedule.`,
              );
              return;
            }
          }
        }
      } catch (schedErr) {
        // If schedule fetch fails, let the backend handle validation
        console.warn("Could not validate schedule overlap:", schedErr);
      }
    }

    try {
      setOvertimeLoading(true);
      const requestData = {
        type: overtimeForm.type,
        date: overtimeForm.date,
        reason: overtimeForm.reason,
      };

      // Use start/end times for both SHIFT_EXTENSION and OFF_SHIFT
      if (overtimeForm.requestedStartTime && overtimeForm.requestedEndTime) {
        requestData.requestedStartTime = overtimeForm.requestedStartTime;
        requestData.requestedEndTime = overtimeForm.requestedEndTime;
      } else if (overtimeForm.requestedHours) {
        // fallback for older input (if present)
        requestData.requestedHours = parseFloat(overtimeForm.requestedHours);
      }

      await overtimeService.createOvertimeRequest(requestData);
      setOvertimeSuccess("Overtime request submitted successfully!");
      setOvertimeForm({
        type: "SHIFT_EXTENSION",
        date: new Date().toISOString().split("T")[0],
        requestedHours: "",
        requestedStartTime: "",
        requestedEndTime: "",
        durationHours: "",
        reason: "",
      });
      fetchOvertimeRequests();
      setTimeout(() => {
        setShowOvertimeModal(false);
        setOvertimeSuccess("");
      }, 2000);
    } catch (err) {
      setOvertimeError(
        err.error || err.message || "Failed to submit overtime request",
      );
    } finally {
      setOvertimeLoading(false);
    }
  };

  // Listen for session-updated events from global ShiftModals component
  useEffect(() => {
    const handleSessionUpdated = () => {
      fetchWorkSessionData();
      fetchOvertimeRequests();
    };
    window.addEventListener("session-updated", handleSessionUpdated);
    return () =>
      window.removeEventListener("session-updated", handleSessionUpdated);
  }, [fetchWorkSessionData, fetchOvertimeRequests]);

  // Online colleagues
  const onlineColleagues = [
    {
      name: "Sarah J.",
      avatar: "SJ",
      status: "online",
      activity: "In a meeting",
    },
    { name: "Mike C.", avatar: "MC", status: "online", activity: "Available" },
    { name: "Emily D.", avatar: "ED", status: "away", activity: "On break" },
    { name: "James W.", avatar: "JW", status: "online", activity: "Coding" },
    { name: "Lisa A.", avatar: "LA", status: "online", activity: "Available" },
    {
      name: "David K.",
      avatar: "DK",
      status: "busy",
      activity: "Do not disturb",
    },
  ];

  // Toggle task status (TODO/IN_PROGRESS ↔ DONE)
  const handleTaskToggle = async (task) => {
    const newStatus = task.status === "DONE" ? "TODO" : "DONE";
    const delta = newStatus === "DONE" ? 1 : -1;
    // Optimistic update
    setTodayTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)),
    );
    setDoneTaskCount((prev) => prev + delta);
    try {
      await taskService.updateTaskStatus(task.id, newStatus);
    } catch (err) {
      // Revert on failure
      setTodayTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)),
      );
      setDoneTaskCount((prev) => prev - delta);
    }
  };

  // Weekly stats from API or defaults
  const hoursWorked = Math.round((weeklySummary?.totalWorkMinutes || 0) / 60);
  const hoursTarget = Math.round(
    (weeklySummary?.scheduledWeeklyMinutes || 2400) / 60,
  );
  const productivity =
    hoursTarget > 0
      ? Math.min(Math.round((hoursWorked / hoursTarget) * 100), 100)
      : 0;

  const getStatusColor = (status) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "away":
        return "bg-yellow-500";
      case "busy":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toUpperCase()) {
      case "HIGH":
      case "URGENT":
        return "text-red-600 bg-red-50";
      case "MEDIUM":
        return "text-yellow-600 bg-yellow-50";
      case "LOW":
      default:
        return "text-blue-600 bg-blue-50";
    }
  };

  // Determine work status
  const isWorking = sessionData?.isWorking || false;
  const isOnBreak = sessionData?.session?.status === "ON_BREAK";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {showComingSoon && toastMessage && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in bg-white border border-gray-200 rounded-xl shadow-lg px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            {toastMessage.title === "No Messages" ? (
              <MessageSquare className="w-5 h-5 text-primary" />
            ) : (
              <Sparkles className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {toastMessage.title}
            </p>
            <p className="text-xs text-gray-500">{toastMessage.description}</p>
          </div>
          <button
            onClick={() => setShowComingSoon(false)}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Welcome Banner with Quote */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary-dark to-primary p-6 text-white">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-primary-100 mb-2">
                <greeting.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{greeting.text}</span>
                <span className="text-lg">{greeting.emoji}</span>
              </div>
              <h1 className="text-3xl font-bold font-heading mb-2">
                Welcome back, {user?.employee?.firstName || "there"}!
              </h1>
              <p className="text-primary-100 mb-4">
                Ready to make today productive?
              </p>

              {/* Quote Section */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 max-w-xl">
                <div className="flex gap-3">
                  <Quote className="w-8 h-8 text-primary-200 flex-shrink-0" />
                  <div>
                    <p className="text-white/90 italic text-sm leading-relaxed">
                      "{quotes[quoteIndex].text}"
                    </p>
                    <p className="text-primary-200 text-xs mt-2">
                      — {quotes[quoteIndex].author}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Clock In Section */}
            <div
              className={`flex gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 ${isWorking ? "flex-row" : "flex-col items-center"}`}
            >
              {/* Time & Buttons */}
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className="text-primary-100 text-sm font-medium">
                    Current Time
                  </p>
                  <p className="text-4xl font-bold mt-1 font-heading">
                    {currentTime.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: clientTz,
                    })}
                  </p>
                  <p className="text-primary-200 text-xs mt-1">
                    {currentTime.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      timeZone: clientTz,
                    })}
                  </p>
                </div>

                {isWorking && (
                  <div
                    className={`text-center py-2 px-4 rounded-lg w-full ${isInExtension ? "bg-orange-500/20" : "bg-green-500/20"}`}
                  >
                    <p
                      className={`text-xs ${isInExtension ? "text-orange-300" : "text-green-300"}`}
                    >
                      {isOnBreak
                        ? "On Break"
                        : isInExtension
                          ? "Shift Extension"
                          : "Active Session"}
                    </p>
                    <p className="text-2xl font-bold text-white font-mono">
                      {isOnBreak && sessionData?.session?.currentBreak
                        ? formatDurationWithSeconds(
                            sessionData.session.currentBreak.startTime,
                          )
                        : formatDurationWithSeconds(
                            sessionData?.session?.startTime,
                            sessionData?.session?.breaks,
                          )}
                    </p>
                  </div>
                )}

                {isLoading ? (
                  <div className="w-full py-4 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                  </div>
                ) : isWorking ? (
                  <div className="flex flex-col gap-2 w-full">
                    {isOnBreak ? (
                      <Button
                        variant="warning"
                        size="lg"
                        onClick={handleEndBreak}
                        loading={actionLoading}
                        icon={Play}
                        className="w-full"
                      >
                        End Break
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleStartBreak}
                        loading={actionLoading}
                        icon={Coffee}
                        className="w-full"
                      >
                        Take Break
                      </Button>
                    )}
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={handleClockOut}
                      loading={actionLoading}
                      icon={Square}
                      className="w-full"
                    >
                      Clock Out
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={handleClockIn}
                    loading={actionLoading}
                    icon={Play}
                    className="w-full"
                  >
                    Clock In
                  </Button>
                )}
              </div>

              {/* Activity Notes - shown on the side when working */}
              {isWorking && (
                <div className="flex-1 pl-4 border-l border-white/20 min-w-[200px]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-primary-100 text-sm">
                      <StickyNote className="w-4 h-4" />
                      <span>Activity Notes</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-primary-200">
                      {notesSaving ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : notesLastSaved ? (
                        <>
                          <Check className="w-3 h-3 text-green-300" />
                          <span>Saved</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <textarea
                    value={activityNotes}
                    onChange={handleNotesChange}
                    placeholder="What are you working on?"
                    className="w-full h-28 p-3 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 resize-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          // {
          //   icon: Clock,
          //   label: "Time Clock",
          //   color: "primary",
          //   link: "/employee/time-clock",
          // },
          {
            icon: Calendar,
            label: "Schedule",
            color: "secondary",
            link: "/employee/schedule",
          },
          {
            icon: TrendingUp,
            label: "Overtime",
            color: "warning",
            link: "#",
            action: "overtime",
          },
          // { icon: Video, label: "Join Meeting", color: "accent", link: "#", action: "comingSoon" },
          {
            icon: MessageSquare,
            label: "Messages",
            color: "info",
            badge: unreadMessageCount > 0 ? unreadMessageCount : null,
            link: "/employee/chat",
            action: "messages",
          },
        ].map((action) => (
          <Card
            key={action.label}
            className="group cursor-pointer hover:shadow-lg transition-all"
            onClick={() => {
              if (action.action === "overtime") {
                setShowOvertimeModal(true);
              } else if (action.action === "comingSoon") {
                triggerComingSoon();
              } else if (action.action === "messages") {
                navigate(action.link);
              } else if (action.link !== "#") {
                navigate(action.link);
              }
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-xl bg-${action.color}-100 group-hover:scale-110 transition-transform`}
              >
                <action.icon className={`w-6 h-6 text-${action.color}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{action.label}</p>
                {action.badge && (
                  <Badge variant="danger" size="xs">
                    {action.badge} new
                  </Badge>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Stats & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Row */}
          <div className="overflow-x-auto pb-2">
            <div className="grid grid-cols-5 gap-4 min-w-[700px]">
              <Card className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-primary-100 flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {hoursWorked}h
                </p>
                <p className="text-xs text-gray-500">Hours This Week</p>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${hoursTarget > 0 ? Math.min((hoursWorked / hoursTarget) * 100, 100) : 0}%`,
                    }}
                  />
                </div>
              </Card>

              <Card className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {doneTaskCount}
                </p>
                <p className="text-xs text-gray-500">Tasks Done</p>
                <p className="text-xs text-gray-400 mt-2">
                  of {totalTaskCount} total
                </p>
              </Card>

              <Card className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-secondary-100 flex items-center justify-center mb-3">
                  <Target className="w-6 h-6 text-secondary-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {totalTaskCount - doneTaskCount}
                </p>
                <p className="text-xs text-gray-500">Tasks Pending</p>
                <p className="text-xs text-gray-400 mt-2">This week</p>
              </Card>

              <Card className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-accent-100 flex items-center justify-center mb-3">
                  <Zap className="w-6 h-6 text-accent-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {productivity}%
                </p>
                <p className="text-xs text-gray-500">Productivity</p>
                <Badge
                  variant={
                    productivity >= 80
                      ? "success"
                      : productivity >= 50
                        ? "warning"
                        : "danger"
                  }
                  size="xs"
                  className="mt-2"
                >
                  {productivity >= 80
                    ? "On Track"
                    : productivity >= 50
                      ? "Moderate"
                      : "Needs Attention"}
                </Badge>
              </Card>

              <Card className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                </div>
                {nextPayrollDate ? (
                  <>
                    <p className="text-lg font-bold text-gray-900">
                      {new Date(nextPayrollDate.cutoffDate).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        },
                      )}
                    </p>
                    <p className="text-xs text-gray-500">Next Payroll Date</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {nextPayrollDate.daysUntilCutoff > 0
                        ? `${nextPayrollDate.daysUntilCutoff} days left`
                        : "Due today"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-gray-400">—</p>
                    <p className="text-xs text-gray-500">Next Payroll Date</p>
                    {/* <p className="text-xs text-gray-400 mt-2">Not set</p> */}
                  </>
                )}
              </Card>
            </div>
          </div>

          {/* Today's Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Today's Focus
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Sparkles}
                  onClick={() => navigate("/employee/tasks?tab=personal")}
                >
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : todayTasks.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No tasks assigned yet</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {todayTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                          task.status === "DONE"
                            ? "bg-green-50/50"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <button
                          onClick={() => handleTaskToggle(task)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            task.status === "DONE"
                              ? "bg-green-500 border-green-500"
                              : "border-gray-300 hover:border-primary"
                          }`}
                        >
                          {task.status === "DONE" && (
                            <CheckCircle className="w-3.5 h-3.5 text-white" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={`text-sm font-medium truncate ${task.status === "DONE" ? "text-gray-400 line-through" : "text-gray-900"}`}
                            >
                              {task.title}
                            </p>
                            {task.isPersonal ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-600 font-medium flex-shrink-0">
                                Personal
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary-100 text-secondary-600 font-medium flex-shrink-0">
                                Client
                              </span>
                            )}
                          </div>
                          {task.client?.companyName && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {task.client.companyName}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${getPriorityColor(task.priority)}`}
                        >
                          {task.priority?.toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Progress */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">
                        Overall Progress
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {doneTaskCount}/{totalTaskCount} done
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
                        style={{
                          width: `${totalTaskCount > 0 ? (doneTaskCount / totalTaskCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {totalTaskCount > 5 && (
                    <button
                      onClick={() => navigate("/employee/tasks")}
                      className="w-full mt-3 py-2.5 text-sm font-medium text-primary hover:bg-primary-50 rounded-xl transition-colors"
                    >
                      View all {totalTaskCount} tasks
                    </button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* My Overtime Requests */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  My Overtime Requests
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Sparkles}
                  onClick={() => setShowOvertimeModal(true)}
                >
                  New Request
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {overtimeRequestsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : myOvertimeRequests.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">No overtime requests yet</p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowOvertimeModal(true)}
                  >
                    Request Overtime
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myOvertimeRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-bold text-gray-900">
                          {new Date(request.date).toLocaleDateString("en-US", {
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(request.date).toLocaleDateString("en-US", {
                            month: "short",
                          })}
                        </p>
                      </div>
                      <div className="w-px h-12 bg-gray-200 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900 whitespace-nowrap">
                            {formatDuration(request.requestedMinutes)}
                          </p>
                          <Badge
                            variant={
                              request.status === "APPROVED"
                                ? "success"
                                : request.status === "REJECTED"
                                  ? "danger"
                                  : "warning"
                            }
                            size="xs"
                          >
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 break-words">
                          {request.reason}
                        </p>
                        {request.type === 'OFF_SHIFT' && request.requestedStartTime && request.requestedEndTime && (
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTime12(request.requestedStartTime)} – {formatTime12(request.requestedEndTime)}
                          </p>
                        )}
                        {request.status === "APPROVED" && request.approver && (
                          <p className="text-xs text-green-600 mt-1">
                            Approved by {request.approver.name}
                          </p>
                        )}
                        {request.status === "REJECTED" && (
                          <>
                            {request.rejecter && (
                              <p className="text-xs text-red-500 mt-1">
                                Rejected by {request.rejecter.name}
                              </p>
                            )}
                            {request.rejectionReason && (
                              <p className="text-xs text-red-400">
                                Reason: {request.rejectionReason}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Today's Meetings */}
          {/*    <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-secondary" />
                  Today's Meetings
                </CardTitle>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent>
              TODO: Replace empty state with todayMeetings.map when data is available
              <div className="space-y-4">
                {todayMeetings.map((meeting, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                  >
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-bold text-gray-900">
                        {meeting.time.split(" ")[0]}
                      </p>
                      <p className="text-xs text-gray-500">
                        {meeting.time.split(" ")[1]}
                      </p>
                    </div>
                    <div className="w-px h-12 bg-gray-200" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900">
                          {meeting.title}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                          {meeting.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {meeting.duration}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {meeting.participants} people
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Video}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Join
                    </Button>
                  </div>
                ))}
              </div>
            
              <div className="text-center py-8">
                <Video className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No meetings scheduled</p>
              </div>
            </CardContent>
          </Card>  */}
        </div>

        {/* Right Column - Team & Announcements */}
        <div className="space-y-6">
          {/* Announcements */}
          {/*      <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-accent" />
                Announcements
              </CardTitle>
            </CardHeader>
            <CardContent>
            TODO: Replace empty state with announcements.map when data is available
              <div className="space-y-3">
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          item.type === "event"
                            ? "bg-purple-100"
                            : item.type === "hr"
                              ? "bg-green-100"
                              : "bg-blue-100"
                        }`}
                      >
                        {item.type === "event" ? (
                          <Calendar className="w-4 h-4 text-purple-600" />
                        ) : item.type === "hr" ? (
                          <Heart className="w-4 h-4 text-green-600" />
                        ) : (
                          <Bell className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 text-sm">
                            {item.title}
                          </p>
                          {item.isNew && (
                            <Badge variant="danger" size="xs">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 capitalize">
                          {item.type}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="text-center py-8">
                <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No announcements yet</p>
              </div>
            </CardContent>
          </Card>*/}

          {/* Wellness Reminder */}
          <Card className="bg-gradient-to-br from-green-50 to-teal-50 border-green-100">
            <CardContent>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-white shadow-lg flex items-center justify-center mb-4">
                  <Coffee className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Take a Break!</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {isWorking && !isOnBreak
                    ? "You've been working hard. A short break can boost your productivity!"
                    : "Remember to take regular breaks for better focus."}
                </p>
                {isWorking && !isOnBreak ? (
                  <Button
                    variant="success"
                    size="sm"
                    icon={Coffee}
                    onClick={triggerComingSoon}
                  >
                    Start 5-min Break
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    size="sm"
                    icon={Heart}
                    onClick={triggerComingSoon}
                  >
                    Wellness Tips
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Achievement */}
          {/* <Card className="bg-gradient-to-br from-accent-50 to-yellow-50 border-accent-100">
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center">
                  <Award className="w-7 h-7 text-accent-600" />
                </div>
                <div>
                  <p className="text-xs text-accent-600 font-medium">
                    ACHIEVEMENT UNLOCKED
                  </p>
                  <p className="font-bold text-gray-900">Productivity Star!</p>
                  <p className="text-sm text-gray-600">
                    5 days streak of 8+ hours
                  </p>
                </div>
              </div>
            </CardContent>
          </Card> */}
        </div>
      </div>

      {/* Weekly Schedule Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              This Week's Schedule
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              icon={ChevronRight}
              iconPosition="right"
              onClick={() => navigate("/employee/schedule")}
            >
              View Full Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {weekSchedule.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Calendar className="w-10 h-10 mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">
                You don't have a schedule assigned for this week
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Contact your admin to set up your schedule
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekSchedule.map((daySchedule, index) => {
                const dayDate = new Date(daySchedule.date + "T00:00:00");
                const now = new Date();
                const todayStart = new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate(),
                );
                const isToday =
                  todayStart.getTime() ===
                  new Date(
                    dayDate.getFullYear(),
                    dayDate.getMonth(),
                    dayDate.getDate(),
                  ).getTime();
                const isPast = dayDate < todayStart;
                const isScheduled = daySchedule.isScheduled;

                // Check for approved shift extension on this day
                const approvedExtension = myOvertimeRequests.find(
                  (ot) =>
                    ot.type === "SHIFT_EXTENSION" &&
                    ot.status === "APPROVED" &&
                    ot.date?.split("T")[0] === daySchedule.date,
                );

                return (
                  <div
                    key={daySchedule.date || index}
                    className={`relative p-3 rounded-xl text-center transition-all ${
                      isToday
                        ? "bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg scale-105"
                        : isPast && isScheduled
                          ? "bg-green-50 border border-green-100"
                          : !isScheduled
                            ? "bg-gray-50 border border-gray-100 opacity-60"
                            : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    {isToday && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <Badge variant="accent" size="xs">
                          Today
                        </Badge>
                      </div>
                    )}
                    <p
                      className={`text-sm font-medium ${
                        isToday ? "text-primary-100" : "text-gray-500"
                      }`}
                    >
                      {DAY_NAMES[dayDate.getDay()]}
                    </p>
                    <p
                      className={`text-2xl font-bold mt-1 ${
                        isToday ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {dayDate.getDate()}
                    </p>
                    <p
                      className={`text-[9px] mt-2 whitespace-nowrap ${
                        isToday
                          ? "text-primary-100"
                          : isScheduled
                            ? "text-gray-600"
                            : "text-gray-400"
                      }`}
                    >
                      {isScheduled ? (
                        `${formatTime12(daySchedule.startTime)} – ${formatTime12(daySchedule.endTime)} EST`
                      ) : (
                        "Off"
                      )}
                    </p>
                    {approvedExtension && isScheduled && (
                      <span
                        className={`text-[10px] font-medium ${isToday ? "text-green-200" : "text-green-600"}`}
                      >
                        +{formatDuration(approvedExtension.requestedMinutes)} OT
                      </span>
                    )}
                    {isPast && !isToday && isScheduled && (
                      <CheckCircle className="w-4 h-4 text-green-500 mx-auto mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overtime Request Modal */}
      {showOvertimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-100">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Request Overtime
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowOvertimeModal(false);
                  setOvertimeError("");
                  setOvertimeSuccess("");
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleOvertimeSubmit}
              className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent"
            >
              {overtimeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{overtimeError}</p>
                </div>
              )}

              {overtimeSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <p className="text-green-700 text-sm">{overtimeSuccess}</p>
                </div>
              )}

              {/* Overtime Type Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Overtime Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOvertimeForm({
                        ...overtimeForm,
                        type: "SHIFT_EXTENSION",
                      })
                    }
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      overtimeForm.type === "SHIFT_EXTENSION"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <p className="text-sm font-semibold">Shift Extension</p>
                    <p className="text-xs mt-0.5 opacity-75">
                      Continue past shift end
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOvertimeForm({ ...overtimeForm, type: "OFF_SHIFT" })
                    }
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      overtimeForm.type === "OFF_SHIFT"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <p className="text-sm font-semibold">Off-Shift Hours</p>
                    <p className="text-xs mt-0.5 opacity-75">
                      Work outside schedule
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={overtimeForm.date}
                  onChange={(e) =>
                    setOvertimeForm({ ...overtimeForm, date: e.target.value })
                  }
                  min={new Date().toISOString().split("T")[0]}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  required
                />
              </div>

              {overtimeForm.type === "SHIFT_EXTENSION" ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shift End Time
                    </label>
                    <input
                      type="time"
                      value={getTodayShiftEndTime() || ""}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Overtime Duration
                    </label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {[
                        { label: "15 min", value: "15" },
                        { label: "30 min", value: "30" },
                        { label: "45 min", value: "45" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setOvertimeForm({
                              ...overtimeForm,
                              durationHours: opt.value,
                            })
                          }
                          className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                            overtimeForm.durationHours === opt.value
                              ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                              : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="5"
                        max="720"
                        step="5"
                        placeholder="Enter overtime duration"
                        value={overtimeForm.durationHours}
                        onChange={(e) =>
                          setOvertimeForm({
                            ...overtimeForm,
                            durationHours: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors pr-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        mins
                      </span>
                    </div>
                  </div>
                  {getCalculatedEndTime() && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Estimated End Time:</span>{" "}
                        <span className="text-primary font-semibold">
                          {formatTime12(getCalculatedEndTime())}
                        </span>
                      </p>
                    </div>
                  )}
                  {!getTodayShiftEndTime() && (
                    <p className="text-xs text-amber-600">
                      No scheduled shift found for today. Please contact your
                      admin.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={overtimeForm.requestedStartTime}
                      onChange={(e) =>
                        setOvertimeForm({
                          ...overtimeForm,
                          requestedStartTime: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={overtimeForm.requestedEndTime}
                      onChange={(e) =>
                        setOvertimeForm({
                          ...overtimeForm,
                          requestedEndTime: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                      required
                    />
                  </div>
                  <p className="col-span-2 text-xs text-gray-500">
                    Specific time range outside your schedule
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Overtime
                </label>
                <textarea
                  rows={3}
                  placeholder="Please explain why overtime is needed..."
                  value={overtimeForm.reason}
                  onChange={(e) =>
                    setOvertimeForm({ ...overtimeForm, reason: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowOvertimeModal(false);
                    setOvertimeError("");
                    setOvertimeSuccess("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={overtimeLoading}
                  className="flex-1"
                >
                  Submit Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift End & Pause Modals now handled globally by ShiftModals component in DashboardLayout */}

      {/* Post-Shift Clock-In Warning Modal (overtime requested but not approved) */}
      {showPostShiftWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-100">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    No Approved Overtime
                  </h2>
                  <p className="text-sm text-gray-500">Your shift has ended</p>
                </div>
              </div>
              <button
                onClick={() => setShowPostShiftWarning(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                <p className="text-sm text-red-800 font-medium mb-2">
                  No approved overtime. You may not get paid.
                </p>
                <p className="text-sm text-red-700">
                  This requires special approval at client's discretion. Hours
                  worked outside your schedule without prior overtime approval
                  may not be compensated.
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Do you still want to clock in?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPostShiftWarning(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handlePostShiftClockIn}
                  loading={actionLoading}
                  className="flex-1"
                >
                  Clock In Anyway
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Late Clock-In Warning Modal (no overtime requested, clocking in after shift end) */}
      {showLateClockInWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Late Clock-In
                  </h2>
                  <p className="text-sm text-gray-500">Your shift has ended</p>
                </div>
              </div>
              <button
                onClick={() => setShowLateClockInWarning(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                <p className="text-sm text-amber-800">
                  {clockInWarningMessage ||
                    "You are clocking in after your scheduled hours. These hours may require client approval."}
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Do you still want to clock in?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowLateClockInWarning(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="warning"
                  onClick={handleLateClockIn}
                  loading={actionLoading}
                  className="flex-1"
                >
                  Clock In Anyway
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Early Clock-In Warning Modal */}
      {showEarlyClockInWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Early Clock-In
                  </h2>
                  <p className="text-sm text-gray-500">
                    Your shift hasn't started yet
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEarlyClockInWarning(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                <p className="text-sm text-amber-800 font-medium mb-2">
                  Your shift hasn't started. You may not get paid for these
                  hours.
                </p>
                <p className="text-sm text-amber-700">
                  Hours worked before your scheduled start time will be logged
                  as overtime and require separate approval from your client.
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Do you still want to clock in early?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowEarlyClockInWarning(false)}
                  className="flex-1"
                >
                  Wait for Shift
                </Button>
                <Button
                  variant="warning"
                  onClick={handleEarlyClockIn}
                  loading={actionLoading}
                  className="flex-1"
                >
                  Clock In Early
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unscheduled Day Warning Modal */}
      {showUnscheduledDayWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-100">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    No Schedule Today
                  </h2>
                  <p className="text-sm text-gray-500">
                    This will be recorded as Extra Time
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUnscheduledDayWarning(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl mb-6">
                <p className="text-sm text-orange-800 font-medium mb-2">
                  You don't have a schedule assigned for today.
                </p>
                <p className="text-sm text-orange-700">
                  All hours worked will be logged as Extra Time and require
                  client approval before they are compensated.
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Do you still want to clock in?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowUnscheduledDayWarning(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="warning"
                  onClick={handleUnscheduledDayClockIn}
                  loading={actionLoading}
                  className="flex-1"
                >
                  Clock In as Extra Time
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Late Arrival Warning Modal */}
      {showLateArrivalWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Late Clock-In
                  </h2>
                  <p className="text-sm text-gray-500">
                    You are past your scheduled start time
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLateArrivalWarning(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                <p className="text-sm text-amber-800 font-medium mb-2">
                  {clockInWarningMessage ||
                    "You are clocking in late. This will be recorded as a late arrival."}
                </p>
                <p className="text-sm text-amber-700">
                  Late arrivals are tracked and reported. Please ensure you
                  arrive on time for your scheduled shifts.
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Do you want to proceed with clocking in?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowLateArrivalWarning(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="warning"
                  onClick={handleLateArrivalClockIn}
                  loading={actionLoading}
                  className="flex-1"
                >
                  Clock In Late
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
