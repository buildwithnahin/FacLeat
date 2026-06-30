'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, User, Star, ClipboardCheck, Clock, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { ScheduleInterviewForm } from './schedule-interview-form';
import { EvaluateInterviewForm } from './evaluate-interview-form';

interface Candidate {
  id: string;
  title: string;
  subject: string;
  metadata: any;
}

interface Interview {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  priority: string;
  startDate: Date | null;
  endDate: Date | null;
  amount: any;
  owner: string | null;
  notes: string | null;
  metadata: any;
}

interface Props {
  interviews: Interview[];
  shortlistedCandidates: Candidate[];
  canWrite: boolean;
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  Scheduled: 'warning',
  Selected: 'success',
  Rejected: 'destructive',
};

export function InterviewList({ interviews, shortlistedCandidates, canWrite }: Props) {
  const [activeInterview, setActiveInterview] = useState<Interview | null>(null);

  const totalCount = interviews.length;
  const scheduledCount = interviews.filter((i) => i.status === 'Scheduled').length;
  const passedCount = interviews.filter((i) => i.status === 'Selected').length;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Interviews</p>
              <p className="mt-2 text-2xl font-bold">{totalCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Scheduled / Pending</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">{scheduledCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Recommendations (Selected)</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{passedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Interview form panel */}
        {canWrite && (
          <div>
            {activeInterview ? (
              <Card className="border-t-4 border-t-amber-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    Record Evaluation
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setActiveInterview(null)}
                  >
                    Cancel
                  </Button>
                </CardHeader>
                <CardContent>
                  <EvaluateInterviewForm
                    interviewId={activeInterview.id}
                    candidateName={activeInterview.metadata?.candidateName || activeInterview.title}
                    interviewType={activeInterview.subject || 'Technical'}
                    onSuccess={() => setActiveInterview(null)}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="border-t-4 border-t-primary shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Schedule New Interview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {shortlistedCandidates.length === 0 ? (
                    <div className="text-xs text-amber-600 bg-amber-50 p-4 rounded-lg flex items-start gap-2">
                      <span>No shortlisted candidates available for interview scheduling. Make sure to shortlist candidate applications first.</span>
                    </div>
                  ) : (
                    <ScheduleInterviewForm shortlistedCandidates={shortlistedCandidates} />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Interviews list */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/20 px-6 py-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Interviews Register
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground border-b">
                    <tr>
                      <th className="text-left font-semibold px-4 py-3">Candidate</th>
                      <th className="text-left font-semibold px-4 py-3">Type</th>
                      <th className="text-left font-semibold px-4 py-3">Date & Time</th>
                      <th className="text-left font-semibold px-4 py-3">Panel</th>
                      <th className="text-right font-semibold px-4 py-3">Score</th>
                      <th className="text-left font-semibold px-4 py-3">Status</th>
                      {canWrite && <th className="text-right font-semibold px-4 py-3">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {interviews.length === 0 ? (
                      <tr>
                        <td colSpan={canWrite ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
                          No interviews scheduled yet.
                        </td>
                      </tr>
                    ) : (
                      interviews.map((item) => {
                        const meta = item.metadata || {};
                        const dateFormatted = item.startDate
                          ? new Date(item.startDate).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—';
                        const score = Number(item.amount || 0);

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-muted/20 transition-colors ${
                              activeInterview?.id === item.id ? 'bg-primary/5' : ''
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold text-card-foreground">
                              {meta.candidateName || item.title.replace('Interview - ', '')}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline">{item.subject || 'Technical'}</Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {dateFormatted}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">
                              {item.owner || '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums">
                              {score > 0 ? (
                                <div className="flex items-center justify-end gap-1 text-amber-500">
                                  <Star className="h-3 w-3 fill-current" />
                                  <span>{score.toFixed(1)}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground font-normal">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={STATUS_VARIANT[item.status] || 'outline'}>
                                {item.status}
                              </Badge>
                            </td>
                            {canWrite && (
                              <td className="px-4 py-3 text-right">
                                {item.status === 'Scheduled' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setActiveInterview(item)}
                                    className="h-8 gap-1"
                                  >
                                    Evaluate
                                    <ChevronRight className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">Evaluated</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
