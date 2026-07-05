import React from "react";

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

const Icon: React.FC<IconProps> = ({ name, className = "", filled = false, onClick }) => {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
      onClick={onClick}
    >
      {name}
    </span>
  );
};

export default Icon;
