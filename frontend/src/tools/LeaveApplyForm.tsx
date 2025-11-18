import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
            <Input value={data.employeeName ?? ""} readOnly />
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">Leave Type</p>
            <Input value={data.leaveType ?? ""} readOnly />
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">Start Date</p>
            <Input value={data.startDate ?? ""} readOnly />
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">End Date</p>
            <Input value={data.endDate ?? ""} readOnly />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase text-muted-foreground">Reason</p>
          <Textarea value={data.reason ?? ""} readOnly className="min-h-[120px]" />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Status: <span className="font-medium text-foreground">{data.status ?? "Draft"}</span>
          </div>
          <Button variant="secondary" disabled>
            Submit via HRIS
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
