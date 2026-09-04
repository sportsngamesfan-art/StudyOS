/**
 * Builds the study-plan prompt on the server from rows the API route has
 * already fetched under the caller's own RLS. Nothing user-typed goes into
 * the model: this closes the open-proxy hole where the route used to accept
 * an arbitrary `prompt` from the client.
 */
export interface PlanClass {
  day: string
  subject: string
  start_time: string
  end_time: string
}

export interface PlanAssignment {
  title: string
  subject: string
  deadline: string
  difficulty: string
  hours_required: number
}

export function buildStudyPlanPrompt(
  timetable: PlanClass[],
  assignments: PlanAssignment[],
  now = new Date()
): string {
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const classLines =
    timetable
      .map((c) => `- ${c.day}: ${c.subject} (${c.start_time}-${c.end_time})`)
      .join('\n') || '- No classes scheduled'

  const assignmentLines =
    assignments
      .map(
        (a) =>
          `- ${a.title} (${a.subject}): Due ${new Date(a.deadline).toLocaleDateString()}, ${a.difficulty} difficulty, ${a.hours_required} hours required`
      )
      .join('\n') || '- No assignments'

  return `Create a detailed study plan for the next week (${now.toLocaleDateString()} to ${nextWeek.toLocaleDateString()}).

Classes scheduled:
${classLines}

Pending assignments:
${assignmentLines}

Please provide a structured study plan that:
1. Avoids scheduled classes
2. Prioritizes urgent assignments (closest deadlines first)
3. Allocates appropriate time based on difficulty and required hours
4. Includes study breaks
5. Balances study across different subjects
6. Is realistic and achievable

Format the response as a JSON array with this structure:
[
  {
    "date": "YYYY-MM-DD",
    "subject": "Subject name",
    "duration": hours as number,
    "task": "specific task or topic",
    "priority": "high|medium|low"
  }
]

Return ONLY the JSON array, no other text.`
}
