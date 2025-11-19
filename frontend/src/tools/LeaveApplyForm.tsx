import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAGUIChatStore } from "@/state/aguiChatStore";
import type { ToolComponentProps } from "@/registry/componentRegistry";

interface LeaveProps extends Record<string, unknown> {
  employeeName?: string;
  startDate?: string;
  endDate?: string;
  leaveType?: string;
  reason?: string;
  status?: string;
}

export default function LeaveApplyForm({ props }: ToolComponentProps) {
  const data = props as LeaveProps;
  const sendMsg = useAGUIChatStore((state) => state.send);
  const [employeeName, setEmployeeName] = useState<string>(data.employeeName ?? "");
  const [startDate, setStartDate] = useState<string>(data.startDate ?? "");
  const [endDate, setEndDate] = useState<string>(data.endDate ?? "");
  const [leaveType, setLeaveType] = useState<string>(data.leaveType ?? "Parental Leave");
  const [reason, setReason] = useState<string>(data.reason ?? "");
  const [status, setStatus] = useState<string>(data.status ?? "Draft");
  return (
    <Card className="w-full animate-fade-in">
      <CardHeader>
        <CardTitle>Leave Application Draft</CardTitle>
        <CardDescription>Review the auto-filled form before submitting.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">Employee</p>
            <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="Employee name" />
          </div>
            <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">Leave Type</p>
            <Input value={leaveType} onChange={(e) => setLeaveType(e.target.value)} />
          </div>
            <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">Start Date</p>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
            <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">End Date</p>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase text-muted-foreground">Reason</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[120px]" />
        </div>
          <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Status: <span className="font-medium text-foreground">{status}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                // Reset to defaults
                setEmployeeName(data.employeeName ?? "");
                setStartDate(data.startDate ?? "");
                setEndDate(data.endDate ?? "");
                setLeaveType(data.leaveType ?? "Parental Leave");
                setReason(data.reason ?? "");
                setStatus(data.status ?? "Draft");
              }}
            >
              Reset
            </Button>
            <Button
              variant="secondary"
              disabled={!employeeName || !startDate || !endDate}
              onClick={() => {
                // mark submitted
                setStatus("Submitted");

                // Build human readable message
                const content = `Leave submitted for ${employeeName} from ${startDate} to ${endDate} - ${leaveType}\nReason: ${reason}`;

                // Add assistant message to the chat (showing submitted data)
                const current = useAGUIChatStore.getState();
                const submittedId = `submitted_${Date.now()}`;
                useAGUIChatStore.setState({
                  messages: [
                    ...current.messages,
                    {
                      id: submittedId,
                      role: "assistant",
                      content,
                      metadata: { name: "HRIS" },
                    },
                  ],
                });

                // Also optionally send to agent for further processing
                sendMsg(`Submitted leave: ${JSON.stringify({ employeeName, startDate, endDate, leaveType, reason })}`);
              }}
            >
              Submit via HRIS
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
