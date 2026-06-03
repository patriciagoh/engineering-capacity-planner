import { ChevronDown, ArrowRight, CornerDownRight, X, Info, Plus, type LucideProps } from "lucide-react";

const ICONS = { chevron: ChevronDown, arrow: ArrowRight, subarrow: CornerDownRight, close: X, info: Info, plus: Plus };
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & LucideProps) {
  const C = ICONS[name];
  return <C size={size} aria-hidden {...rest} />;
}
