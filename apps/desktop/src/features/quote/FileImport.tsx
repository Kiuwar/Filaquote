import {
  estimateFromVolume,
  parseBambu3mf,
  parseStl,
  UNIT_LABELS,
  type Bambu3mfResult,
  type LengthUnit,
  type StlResult,
} from "@filaquote/engine";
import { AlertTriangle, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { resolveVolumeSettings, type ProfileData } from "../../domain/profile";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { FileButton } from "../../ui/FileButton";
import { NumberInput } from "../../ui/NumberInput";
import { NumField } from "../../ui/NumField";
import { Select } from "../../ui/Select";
import { decimal, duration } from "../../ui/format";
import { errorMessage } from "../../ui/Toast";

export interface Imported {
  grams: number;
  purgeGrams: number | null;
  printHours: number;
}

function Warnings({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((w) => (
        <li key={w} className="flex gap-2 text-[13px] text-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}
        </li>
      ))}
    </ul>
  );
}

export function StlImport({ profile, onUse }: { profile: ProfileData; onUse(v: Imported): void }) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [unit, setUnit] = useState<LengthUnit>("mm");
  const [infill, setInfill] = useState<number | null>(profile.volume.infillPercent);
  const parsed = useMemo((): { stl: StlResult | null; error: string | null } => {
    if (!bytes) return { stl: null, error: null };
    try {
      return { stl: parseStl(bytes, unit), error: null };
    } catch (err) {
      return { stl: null, error: errorMessage(err) };
    }
  }, [bytes, unit]);
  const { stl, error } = parsed;
  const settings = resolveVolumeSettings({
    ...profile,
    volume: { ...profile.volume, infillPercent: infill },
  });
  const estimate = stl && settings.ok ? estimateFromVolume(stl.volumeMm3, settings.value) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <FileButton
          accept=".stl"
          onFile={async (f) => {
            setFileName(f.name);
            setBytes(new Uint8Array(await f.arrayBuffer()));
          }}
        >
          Escolher STL
        </FileButton>
        {fileName && <span className="text-sm text-muted">{fileName}</span>}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {stl && (
        <div className="flex flex-col gap-3 rounded-control border border-line bg-surface-2 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-sm">
              <p>
                Volume: <strong>{decimal(stl.volumeMm3 / 1000)} cm³</strong>
              </p>
              <p className="text-muted">
                {stl.sizeMm.map((s) => decimal(s)).join(" × ")} mm ·{" "}
                {stl.triangles.toLocaleString("pt-BR")} triângulos
              </p>
              <p className="mt-1">
                {stl.closed ? (
                  <Badge tone="success" icon={<Check size={12} />}>
                    Malha fechada
                  </Badge>
                ) : (
                  <Badge tone="warning">Malha aberta</Badge>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Unidade do arquivo</span>
              <Select
                value={unit}
                onValueChange={(v) => setUnit(v as LengthUnit)}
                options={(Object.keys(UNIT_LABELS) as LengthUnit[]).map((u) => ({
                  value: u,
                  label: UNIT_LABELS[u],
                }))}
              />
            </div>
          </div>
          <Warnings items={stl.warnings} />
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField
              label="Preenchimento"
              unit="%"
              max={100}
              value={infill}
              onChange={setInfill}
            />
          </div>
          {!settings.ok ? (
            <p className="text-sm text-warning">
              Para estimar, preencha no perfil: {settings.missing.join(", ")}.
            </p>
          ) : (
            estimate && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  Estimativa: <strong>{decimal(estimate.grams)} g</strong> e{" "}
                  <strong>{duration(estimate.printHours)}</strong>
                  <span className="text-muted"> (precisão menor que a do arquivo fatiado)</span>
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    onUse({
                      grams: estimate.grams,
                      purgeGrams: null,
                      printHours: estimate.printHours,
                    })
                  }
                >
                  Usar estimativa
                </Button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function useBambuFile() {
  const [result, setResult] = useState<Bambu3mfResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = async (file: File) => {
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      setResult(await parseBambu3mf(new Uint8Array(await file.arrayBuffer())));
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return { result, fileName, error, load };
}

export function ThreeMfImport({ onUse }: { onUse(v: Imported): void }) {
  const file = useBambuFile();
  const [copies, setCopies] = useState<number | null>(1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <FileButton accept=".3mf" onFile={file.load}>
          Escolher .gcode.3mf
        </FileButton>
        <Badge tone="warning">Experimental: confira os valores</Badge>
        {file.fileName && <span className="text-sm text-muted">{file.fileName}</span>}
      </div>
      {file.error && <p className="text-sm text-danger">{file.error}</p>}
      {file.result && (
        <div className="flex flex-col gap-3 rounded-control border border-line bg-surface-2 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Cópias desta peça em cada mesa:</span>
            <div className="w-28">
              <NumberInput
                aria-label="Cópias por mesa"
                value={copies}
                integer
                min={1}
                onChange={setCopies}
              />
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {file.result.plates.map((p) => (
              <li
                key={p.index}
                className="flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <span>
                  Mesa {p.index}: <strong>{duration(p.printHours)}</strong> e{" "}
                  <strong>{decimal(p.grams)} g</strong>
                  {p.filaments.length > 0 && (
                    <span className="text-muted">
                      {" "}
                      ·{" "}
                      {p.filaments
                        .map((f) => `${f.type ?? "?"} ${decimal(f.usedGrams)} g`)
                        .join(", ")}
                    </span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!copies}
                  onClick={() =>
                    copies &&
                    onUse({
                      grams: p.grams / copies,
                      purgeGrams: null,
                      printHours: p.printHours / copies,
                    })
                  }
                >
                  Usar mesa {p.index}
                </Button>
              </li>
            ))}
          </ul>
          {file.result.slicerVersion && (
            <p className="text-xs text-muted">Bambu Studio {file.result.slicerVersion}</p>
          )}
        </div>
      )}
    </div>
  );
}
