import { useEffect, useRef, useState, useCallback } from "react";
import ePub, { type Book as EpubBook, type Rendition } from "epubjs";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme-provider";

interface EpubReaderProps {
  bookUrl: string;
  initialPosition?: string;
  onPositionChange?: (position: string, chapter?: string) => void;
  onTextSelect?: (text: string, context: string, rect: DOMRect) => void;
}

export function EpubReader({
  bookUrl,
  initialPosition,
  onPositionChange,
  onTextSelect,
}: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [fontSize, setFontSize] = useState(100);
  const [currentChapter, setCurrentChapter] = useState("");
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const { theme } = useTheme();

  const applyTheme = useCallback((rendition: Rendition) => {
    if (theme === "dark") {
      rendition.themes.override("color", "#e8e6e3");
      rendition.themes.override("background", "transparent");
    } else {
      rendition.themes.override("color", "#2a2521");
      rendition.themes.override("background", "transparent");
    }
  }, [theme]);

  useEffect(() => {
    if (!viewerRef.current) return;

    let destroyed = false;

    async function loadBook() {
      const response = await fetch(bookUrl, { credentials: "include" });
      if (!response.ok || destroyed) return;
      const arrayBuffer = await response.arrayBuffer();
      if (destroyed || !viewerRef.current) return;

      const book = ePub(arrayBuffer);
      bookRef.current = book;

      const rendition = book.renderTo(viewerRef.current, {
        width: "100%",
        height: "100%",
        spread: "none",
        flow: "paginated",
      });

      renditionRef.current = rendition;

      rendition.themes.default({
        body: {
          "font-family": "'Libre Baskerville', 'Georgia', serif !important",
          "line-height": "1.8 !important",
          "padding": "20px 40px !important",
        },
        "p": {
          "margin-bottom": "0.8em !important",
        },
        "a": {
          "color": "inherit !important",
        },
      });

      rendition.themes.fontSize(`${fontSize}%`);
      applyTheme(rendition);

      if (initialPosition) {
        rendition.display(initialPosition);
      } else {
        rendition.display();
      }

      rendition.on("relocated", (location: any) => {
        const cfi = location.start.cfi;
        setAtStart(location.atStart);
        setAtEnd(location.atEnd);

        book.loaded.navigation.then((nav) => {
          const chapter = nav.toc.find((item: any) => {
            return book.canonical(item.href) === book.canonical(location.start.href);
          });
          const chapterTitle = chapter?.label?.trim() || "";
          setCurrentChapter(chapterTitle);
          onPositionChange?.(cfi, chapterTitle);
        });
      });

      rendition.on("selected", (cfiRange: string) => {
        rendition.getRange(cfiRange).then((range: Range) => {
          const selectedText = range.toString().trim();
          if (!selectedText) return;

          const containerEl = viewerRef.current;
          if (!containerEl) return;

          const rects = range.getClientRects();
          if (rects.length === 0) return;

          const lastRect = rects[rects.length - 1];
          const containerRect = containerEl.getBoundingClientRect();

          const adjustedRect = new DOMRect(
            lastRect.x - containerRect.x,
            lastRect.y - containerRect.y,
            lastRect.width,
            lastRect.height
          );

          const surrounding = getSurroundingContext(range);
          onTextSelect?.(selectedText, surrounding, adjustedRect);
        });
      });
    }

    loadBook();

    return () => {
      destroyed = true;
      bookRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookUrl]);

  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current);
    }
  }, [theme, applyTheme]);

  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
    }
  }, [fontSize]);

  function getSurroundingContext(range: Range): string {
    const parent = range.commonAncestorContainer;
    const textContent = parent.textContent || "";
    const selectedText = range.toString();
    const idx = textContent.indexOf(selectedText);
    const start = Math.max(0, idx - 150);
    const end = Math.min(textContent.length, idx + selectedText.length + 150);
    return textContent.slice(start, end);
  }

  const goNext = () => renditionRef.current?.next();
  const goPrev = () => renditionRef.current?.prev();

  const increaseFontSize = () => setFontSize((prev) => Math.min(prev + 10, 160));
  const decreaseFontSize = () => setFontSize((prev) => Math.max(prev - 10, 70));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-card/50">
        <span className="text-xs text-muted-foreground truncate max-w-[200px]" data-testid="text-current-chapter">
          {currentChapter || "Loading..."}
        </span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={decreaseFontSize} data-testid="button-font-decrease">
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{fontSize}%</span>
          <Button size="icon" variant="ghost" onClick={increaseFontSize} data-testid="button-font-increase">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div ref={viewerRef} className="w-full h-full" data-testid="epub-viewer" />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t bg-card/50">
        <Button
          size="icon"
          variant="ghost"
          onClick={goPrev}
          disabled={atStart}
          data-testid="button-prev-page"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={goNext}
          disabled={atEnd}
          data-testid="button-next-page"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
