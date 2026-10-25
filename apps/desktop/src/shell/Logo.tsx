/** Marca do app: camadas empilhadas formando um "F". Segue as cores do tema. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--fq-primary)" />
      <g fill="var(--fq-on-primary)">
        <rect x="17" y="15" width="30" height="8" rx="4" />
        <rect x="17" y="28" width="22" height="8" rx="4" />
        <rect x="17" y="41" width="11" height="8" rx="4" />
      </g>
    </svg>
  );
}
