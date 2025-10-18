import { BirthdayNotifier } from "./BirthdayNotifier";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-10 flex items-center gap-4">
      <BirthdayNotifier />
      <ThemeToggle />
    </div>
  );
}