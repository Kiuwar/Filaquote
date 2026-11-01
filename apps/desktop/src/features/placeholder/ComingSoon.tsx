import { Hammer } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { Card } from "../../ui/Card";

export function ComingSoon({ phase, items }: { phase: number; items: readonly string[] }) {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
          <Hammer size={20} />
        </div>
        <div>
          <Badge tone="accent">Fase {phase}</Badge>
          <p className="mt-2 text-sm text-muted">Esta tela será construída na fase {phase}:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
