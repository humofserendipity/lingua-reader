import type React from "react";
import { Languages, BookText, GraduationCap, BookmarkPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AIAction = "translate" | "quick-grammar" | "deep-grammar" | "save-word" | "save-sentence";

interface FloatingToolbarProps {
  onAction: (action: AIAction) => void;
  onDismiss: () => void;
  coords?: { x: number; y: number };
}

export function FloatingToolbar({ onAction, onDismiss, coords }: FloatingToolbarProps) {
  const style: React.CSSProperties = coords
    ? { position: "fixed", left: coords.x, top: coords.y + 8, transform: "translateX(-50%)", maxWidth: "calc(100vw - 16px)" }
    : { maxWidth: "calc(100vw - 16px)" };

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg z-50"
      style={style}
      data-testid="floating-toolbar"
    >
      <Button size="sm" variant="ghost" className="gap-1 text-xs px-2 h-7" onClick={() => onAction("translate")} data-testid="button-translate">
        <Languages className="w-3 h-3" />Translate
      </Button>
      <Button size="sm" variant="ghost" className="gap-1 text-xs px-2 h-7" onClick={() => onAction("quick-grammar")} data-testid="button-quick-grammar">
        <BookText className="w-3 h-3" />Quick
      </Button>
      <Button size="sm" variant="ghost" className="gap-1 text-xs px-2 h-7" onClick={() => onAction("deep-grammar")} data-testid="button-deep-grammar">
        <GraduationCap className="w-3 h-3" />Deep
      </Button>
      <div className="w-px h-5 bg-border" />
      <Button size="sm" variant="ghost" className="gap-1 text-xs px-2 h-7" onClick={() => onAction("save-word")} data-testid="button-save-word">
        <BookmarkPlus className="w-3 h-3" />Word
      </Button>
      <Button size="sm" variant="ghost" className="gap-1 text-xs px-2 h-7" onClick={() => onAction("save-sentence")} data-testid="button-save-sentence">
        <BookmarkPlus className="w-3 h-3" />Sentence
      </Button>
      <div className="w-px h-5 bg-border" />
      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={onDismiss} data-testid="button-dismiss-toolbar">
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}
