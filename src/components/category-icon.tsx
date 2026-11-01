import { Briefcase, Car, Dumbbell, TreePalm, Home, PawPrint, Sailboat, Search, Shirt, Smartphone, Sofa, Tag, Wrench, type LucideProps } from "lucide-react";

const ICONS = {
  car: Car,
  home: Home,
  smartphone: Smartphone,
  sofa: Sofa,
  shirt: Shirt,
  briefcase: Briefcase,
  wrench: Wrench,
  paw: PawPrint,
  sailboat: Sailboat,
  search: Search,
  dumbbell: Dumbbell,
  palm: TreePalm,
};

export function CategoryIcon({ icon, ...props }: { icon: string } & LucideProps) {
  const Icon = ICONS[icon as keyof typeof ICONS] ?? Tag;
  return <Icon {...props} />;
}
