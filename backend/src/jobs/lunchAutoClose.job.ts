import prisma from '../config/database';

/**
 * Nightly job (2 AM UTC) — finds any work sessions still ON_BREAK from a previous day
 * and auto-closes the open lunch break. This is the safety net for employees who
 * never came back AND never clocked out (e.g., early departure, internet cut out).
 *
 * The auto-closed break appears in the admin review queue the next day.
 */
export const runLunchAutoCloseJob = async (): Promise<void> => {
  try {
    const now = new Date();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    // Sessions still ON_BREAK that started before today
    const staleSessions = await prisma.workSession.findMany({
      where: {
        status: 'ON_BREAK',
        startTime: { lt: todayMidnight },
      },
      include: {
        breaks: { where: { endTime: null } },
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    if (staleSessions.length === 0) return;
    console.log(`[LunchAutoClose] Found ${staleSessions.length} stale ON_BREAK session(s)`);

    for (const session of staleSessions) {
      const openBreak = session.breaks.find((b: any) => b.isLunch);
      if (!openBreak) continue;

      // Close at end of previous day (23:59:59 of the day the session started)
      const closeAt = new Date(todayMidnight.getTime() - 1000);
      const elapsed = Math.round((closeAt.getTime() - openBreak.startTime.getTime()) / 60000);
      const scheduledDuration = (openBreak as any).scheduledDurationMinutes ?? 30;
      const paidMinutes = scheduledDuration;
      const unpaidMinutes = Math.max(0, elapsed - scheduledDuration);

      await prisma.break.update({
        where: { id: openBreak.id },
        data: {
          endTime: closeAt,
          durationMinutes: elapsed,
          paidMinutes,
          unpaidMinutes,
          lunchStatus: 'AUTO_CLOSED',
        } as any,
      });

      // Recalculate totalBreakMinutes and complete the session
      const allBreaks = await prisma.break.findMany({ where: { workSessionId: session.id } });
      const totalBreakMinutes = allBreaks.reduce((total: number, brk: any) => {
        return total + (brk.durationMinutes ?? 0);
      }, 0);

      await prisma.workSession.update({
        where: { id: session.id },
        data: { endTime: closeAt, status: 'COMPLETED', totalBreakMinutes },
      });

      console.log(
        `[LunchAutoClose] Auto-closed stale lunch break for ${session.employee.firstName} ${session.employee.lastName} — paid: ${paidMinutes} min, unpaid: ${unpaidMinutes} min`
      );
    }
  } catch (error) {
    console.error('[LunchAutoClose] Job failed:', error);
  }
};
