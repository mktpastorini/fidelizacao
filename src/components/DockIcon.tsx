"use client";

import * as React from "react";
import { motion, useTransform, MotionValue } from "framer-motion";
import { NavLink } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";

type DockIconProps = {
  mouseX: MotionValue;
  item: { to: string; icon: LucideIcon; label: string };
};

export function DockIcon({ mouseX, item }: DockIconProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  const heightSync = useTransform(distance, [-150, 0, 150], [40, 80, 40]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `flex items-center justify-center rounded-full transition-colors ${
              isActive ? "bg-primary/20" : ""
            }`
          }
        >
          <motion.div
            ref={ref}
            style={{ width: widthSync, height: heightSync }}
            className="aspect-square w-10 rounded-full bg-secondary/50 flex items-center justify-center"
          >
            <item.icon className="w-6 h-6 text-muted-foreground" />
          </motion.div>
        </NavLink>
      </TooltipTrigger>
      <TooltipContent>
        <p>{item.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}