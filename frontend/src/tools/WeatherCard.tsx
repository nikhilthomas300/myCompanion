import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ToolComponentProps } from "@/registry/componentRegistry";

interface WeatherStat {
  label?: string;
  value?: string;
}

interface ForecastEntry {
  label?: string;
  temp?: string;
  condition?: string;
  precipitationChance?: string;
}

interface WeatherPayload extends Record<string, unknown> {
  location?: string;
  asOf?: string;
  summary?: string;
  condition?: string;
  headline?: string;
  temperature?: {
    value?: number | string;
    unit?: string;
  };
  stats?: WeatherStat[];
  forecast?: ForecastEntry[];
  tips?: string[];
}

const formatTemperature = (temperature?: WeatherPayload["temperature"]) => {
  if (!temperature) return "--";
  const { value, unit } = temperature;
  if (typeof value === "number" && !Number.isNaN(value)) {
    return `${Math.round(value)}${unit ?? "°C"}`;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return `--${unit ?? "°C"}`;
};

export default function WeatherCard({ props }: ToolComponentProps) {
  const data = props as WeatherPayload;
  const stats = Array.isArray(data.stats) ? data.stats.filter((stat) => stat.label && stat.value) : [];
  const forecast = Array.isArray(data.forecast) ? data.forecast.filter((entry) => entry.label || entry.temp) : [];
  const tips = Array.isArray(data.tips) ? data.tips : [];

  return (
    <Card className="w-full animate-fade-in overflow-hidden">
      <CardHeader className="bg-slate-50">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xl">{data.location ?? "Weather"}</CardTitle>
          <CardDescription>Updated {data.asOf ?? "just now"}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-500 to-emerald-500 p-6 text-white shadow-inner">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-wide text-white/90">Current conditions</p>
            <div className="flex flex-wrap items-end gap-4">
              <p className="text-6xl font-semibold leading-none">{formatTemperature(data.temperature)}</p>
              <div className="flex flex-col">
                <span className="text-2xl font-medium">{data.condition ?? data.summary ?? "--"}</span>
                {data.headline && <span className="text-sm text-white/80">{data.headline}</span>}
              </div>
            </div>
            {data.summary && <p className="text-sm text-white/90">{data.summary}</p>}
          </div>
        </div>

        {stats.length > 0 && (
          <div>
            <p className="text-xs uppercase text-muted-foreground">Key stats</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {stats.map((stat) => (
                <div
                  key={`${stat.label}-${stat.value}`}
                  className="rounded-xl border border-slate-100 bg-white/60 px-4 py-3 shadow-sm"
                >
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold text-slate-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {forecast.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase text-muted-foreground">Coming up</p>
            <div className="divide-y rounded-2xl border border-slate-100 bg-white/80">
              {forecast.map((entry) => (
                <div key={entry.label ?? entry.temp} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{entry.label ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{entry.condition ?? "Stable"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.precipitationChance && (
                      <Badge variant="outline" className="text-xs text-slate-500">
                        {entry.precipitationChance} rain
                      </Badge>
                    )}
                    <span className="text-lg font-semibold text-slate-900">{entry.temp ?? "--"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tips.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase text-muted-foreground">Prep suggestions</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {tips.map((tip, index) => (
                <li key={`${tip}-${index}`}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
