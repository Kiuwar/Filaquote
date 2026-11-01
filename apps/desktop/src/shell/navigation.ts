import {
  FileCog,
  FilePlus2,
  Repeat,
  FileText,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";

export type PageId =
  "novo" | "orcamentos" | "clientes" | "pecas" | "perfis" | "padroes" | "aparencia" | "dados";

export interface NavItem {
  id: PageId;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "main" | "settings";
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "novo",
    label: "Novo orçamento",
    description: "Monte um orçamento com várias peças e compare métodos de preço.",
    icon: FilePlus2,
    group: "main",
  },
  {
    id: "orcamentos",
    label: "Orçamentos",
    description: "Histórico com status, busca e duplicação.",
    icon: FileText,
    group: "main",
  },
  {
    id: "clientes",
    label: "Clientes",
    description: "Cadastro local de clientes.",
    icon: Users,
    group: "main",
  },
  {
    id: "pecas",
    label: "Peças recorrentes",
    description:
      "Peças que você orça sempre. Guardam a entrada, e o preço é recalculado com os custos de hoje.",
    icon: Repeat,
    group: "main",
  },
  {
    id: "perfis",
    label: "Perfis de cálculo",
    description: "Formas de calcular salvas: impressora, material, tarifas e método de preço.",
    icon: SlidersHorizontal,
    group: "main",
  },
  {
    id: "padroes",
    label: "Orçamento e PDF",
    description: "Numeração, validade, condições, logo e mensagem de WhatsApp.",
    icon: FileCog,
    group: "settings",
  },
  {
    id: "aparencia",
    label: "Aparência",
    description: "Tema, cores e contraste. As mudanças aparecem na hora.",
    icon: Palette,
    group: "settings",
  },
  {
    id: "dados",
    label: "Dados e privacidade",
    description: "Backup, importação e exclusão de dados de clientes.",
    icon: ShieldCheck,
    group: "settings",
  },
];

export function findNavItem(id: PageId): NavItem {
  return NAV_ITEMS.find((i) => i.id === id) ?? NAV_ITEMS[0]!;
}
