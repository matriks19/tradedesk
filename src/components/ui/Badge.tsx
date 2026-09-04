import clsx from "clsx";

export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "up" | "down" | "warn" | "accent";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-medium",
        tone === "muted" && "bg-desk-elevated text-desk-muted",
        tone === "up" && "bg-desk-up/15 text-desk-up",
        tone === "down" && "bg-desk-down/15 text-desk-down",
        tone === "warn" && "bg-desk-warn/15 text-desk-warn",
        tone === "accent" && "bg-desk-accent/15 text-blue-300"
      )}
    >
      {children}
    </span>
  );
}
