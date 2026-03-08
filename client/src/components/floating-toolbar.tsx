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
    ? { position: "fixed", left: coords.x, top: coords.y + 8, transform: "translateX(-50%)" }
    : {};

  return (
    <div
      className="flex items-center gap-1 rounded-lg border bg-popover p-1.5 shadow-lg z-50"
      style={style}
      data-testid="floating-toolbar"
    >
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-xs"
        onClick={() => onAction("translate")}
        data-testid="button-translate"
      >
        <Languages className="w-3.5 h-3.5" />
        Translate
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-xs"
        onClick={() => onAction("quick-grammar")}
        data-testid="button-quick-grammar"
      >
        <BookText className="w-3.5 h-3.5" />
        Quick
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-xs"
        onClick={() => onAction("deep-grammar")}
        data-testid="button-deep-grammar"
      >
        <GraduationCap className="w-3.5 h-3.5" />
        Deep
      </Button>
      <div className="w-px h-5 bg-border mx-0.5" />
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-xs"
        onClick={() => onAction("save-word")}
        data-testid="button-save-word"
      >
        <BookmarkPlus className="w-3.5 h-3.5" />
        Word
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-xs"
        onClick={() => onAction("save-sentence")}
        data-testid="button-save-sentence"
      >
        <BookmarkPlus className="w-3.5 h-3.5" />
        Sentence
      </Button>
      <div className="w-px h-5 bg-border mx-0.5" />
      <Button
        size="icon"
        variant="ghost"
        onClick={onDismiss}
        data-testid="button-dismiss-toolbar"
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
