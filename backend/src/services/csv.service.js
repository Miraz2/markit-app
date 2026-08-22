/**
 * Formats attendance summary & roster logs into CSV string
 */
export function generateSummaryCsv({ department, batch, section, sessionName, summary, sessions }) {
  const lines = [];

  // Header meta
  lines.push(`"UNIVERSITY ATTENDANCE REPORT"`);
  lines.push(`"Department","${department}"`);
  lines.push(`"Batch","${batch}"`);
  lines.push(`"Section","${section}"`);
  if (sessionName) lines.push(`"Academic Session","${sessionName}"`);
  lines.push(`"Total Class Sessions Recorded","${sessions?.length || 0}"`);
  lines.push(`"Report Generated At","${new Date().toLocaleString()}"`);
  lines.push("");

  // Student summary table
  lines.push(`"Student ID","Student Name","Present Sessions","Absent Sessions","Total Sessions","Attendance Percentage"`);

  for (const item of summary) {
    const studentId = `"${item.student.studentId}"`;
    const name = `"${item.student.name.replace(/"/g, '""')}"`;
    const present = item.present;
    const absent = item.absent;
    const total = item.total;
    const percentage = `"${item.percentage}%"`;
    lines.push([studentId, name, present, absent, total, percentage].join(","));
  }

  // Daily log table
  if (sessions && sessions.length > 0) {
    lines.push("");
    lines.push(`"DAILY ATTENDANCE SESSION BREAKDOWN"`);
    lines.push(`"Date","Course","Teacher","Present Count","Absent Count"`);
    for (const s of sessions) {
      const date = `"${s.date}"`;
      const courseName = `"${(s.courseName || 'General').replace(/"/g, '""')}"`;
      const teacher = `"${(s.takenBy?.name || 'N/A').replace(/"/g, '""')}"`;
      const present = s.presentCount ?? s.records?.filter(r => r.status === 'present').length ?? 0;
      const absent = s.absentCount ?? s.records?.filter(r => r.status === 'absent').length ?? 0;
      lines.push([date, courseName, teacher, present, absent].join(","));
    }
  }

  return lines.join("\n");
}
