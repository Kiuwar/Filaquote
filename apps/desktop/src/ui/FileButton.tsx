import { Upload } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Button } from "./Button";

/** Botão que abre o seletor de arquivos e entrega os bytes. Nada sai do computador. */
export function FileButton({
  accept,
  onFile,
  children,
}: {
  accept: string;
  onFile(file: File): void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <Button icon={<Upload size={15} />} onClick={() => ref.current?.click()}>
        {children}
      </Button>
    </>
  );
}
