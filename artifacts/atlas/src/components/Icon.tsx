import { iconSvg, type IconName, type IconWeight } from "@/lib/icons";

interface IconProps {
  name: IconName;
  weight?: IconWeight;
  size?: number;
  className?: string;
}

export default function Icon({ name, weight = "regular", size = 16, className }: IconProps) {
  return (
    <span
      className={`icon${className ? ` ${className}` : ""}`}
      dangerouslySetInnerHTML={{ __html: iconSvg(name, weight, size) }}
    />
  );
}
