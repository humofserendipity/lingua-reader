import { Languages, BookText, GraduationCap, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AIAction = "translate" | "quick-grammar" | "deep-grammar" | "save-word" | "save-sentence";

interface FloatingToolbarProps {
  position: { x: number; y: number };
  visible: boolean;
  onAction: (action: AIAction) => void;
}

export function FloatingToolbar({ position, visible, onAction }: FloatingToolbarProps) {
  if (!visible) return null;

  return (
    <div
      className="absolute z-50 flex items-center gap-0.5 rounded-md border bg-popover p-1 shadow-lg"
      style={{
        left: `${position.x}px`,
        top: `${position.y + 8}px`,
        transform: "translateX(-50%)",
      }}
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
    </div>
  );
}
