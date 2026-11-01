import { cn } from "../ui/cn";
import { NAV_ITEMS, type NavItem, type PageId } from "./navigation";

function NavButton({
  item,
  active,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  onSelect: (id: PageId) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(item.id)}
      className={cn(
        "group flex h-10 w-full cursor-pointer items-center gap-3 rounded-control px-3 text-left text-sm font-medium",
        "transition-all duration-(--fq-dur) ease-fq",
        active ? "bg-primary-soft text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
      )}
    >
      <Icon
        size={18}
        strokeWidth={1.9}
        className={cn(
          "transition-colors duration-(--fq-dur)",
          active ? "text-primary" : "text-muted group-hover:text-ink",
        )}
      />
      {item.label}
    </button>
  );
}

export function Sidebar({
  current,
  onSelect,
}: {
  current: PageId;
  onSelect: (id: PageId) => void;
}) {
  const main = NAV_ITEMS.filter((i) => i.group === "main");
  const settings = NAV_ITEMS.filter((i) => i.group === "settings");
  return (
    <nav
      aria-label="Navegação principal"
      className="flex w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface/60 p-3"
    >
      {main.map((item) => (
        <NavButton key={item.id} item={item} active={item.id === current} onSelect={onSelect} />
      ))}
      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
        <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
          Configurações
        </p>
        {settings.map((item) => (
          <NavButton key={item.id} item={item} active={item.id === current} onSelect={onSelect} />
        ))}
      </div>
    </nav>
  );
}
