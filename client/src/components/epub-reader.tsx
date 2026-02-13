import { useEffect, useRef, useState, useCallback } from "react";
import ePub, { type Book as EpubBook, type Rendition } from "epubjs";
import { ChevronLeft, ChevronRight, Minus, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme-provider";
import { Link } from "wouter";

interface EpubReaderProps {
  bookUrl: string;
  bookTitle?: string;
  initialPosition?: string;
  onPositionChange?: (position: string, chapter?: string) => void;
  onTextSelect?: (text: string, context: string) => void;
}

export function EpubReader({
  bookUrl,
  bookTitle,
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
  const [showControls, setShowControls] = useState(false);
  const [bookLoaded, setBookLoaded] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    if (!viewerRef.current) return;

    let destroyed = false;

    async function loadBook() {
      const response = await fetch(bookUrl, { credentials: "include" });
      if (!response.ok || destroyed) return;
      const arrayBuffer = await response.arrayBuffer();
      if (destroyed || !viewerRef.current) return;

      const container = viewerRef.current;
      const rect = container.getBoundingClientRect();

      const book = ePub(arrayBuffer);
      bookRef.current = book;

      const rendition = book.renderTo(container, {
        width: rect.width,
        height: rect.height,
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
        try {
          const range = rendition.getRange(cfiRange);
          if (!range) return;
          const selectedText = range.toString().trim();
          if (!selectedText) return;
          const surrounding = getSurroundingContext(range);
          onTextSelect?.(selectedText, surrounding);
        } catch (err) {
          console.error("Selection error:", err);
        }
      });

      setBookLoaded(true);

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0 && renditionRef.current) {
            try {
              renditionRef.current.resize(width, height);
            } catch {
            }
          }
        }
      });
      resizeObserver.observe(container);

      (book as any)._resizeObserver = resizeObserver;
    }

    loadBook();

    return () => {
      destroyed = true;
      const book = bookRef.current;
      if (book) {
        const observer = (book as any)._resizeObserver;
        if (observer) observer.disconnect();
        book.destroy();
      }
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

  const goNext = useCallback(() => {
    renditionRef.current?.next();
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const goPrev = useCallback(() => {
    renditionRef.current?.prev();
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const increaseFontSize = () => setFontSize((prev) => Math.min(prev + 10, 160));
  const decreaseFontSize = () => setFontSize((prev) => Math.max(prev - 10, 70));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  const handleAreaClick = (e: React.MouseEvent) => {
    const container = viewerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width * 0.25) {
      goPrev();
    } else if (x > width * 0.75) {
      goNext();
    } else {
      showControlsTemporarily();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div
        className={`flex items-center justify-between gap-4 px-3 py-1.5 border-b bg-card/80 backdrop-blur-sm transition-opacity duration-300 z-20 ${showControls || !bookLoaded ? "opacity-100" : "opacity-0 hover:opacity-100"}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/">
            <Button size="icon" variant="ghost" data-testid="button-back-to-library">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <span className="text-xs text-muted-foreground truncate" data-testid="text-current-chapter">
            {currentChapter || bookTitle || "Loading..."}
          </span>
        </div>
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

      <div className="flex-1 relative overflow-hidden" onClick={handleAreaClick}>
        <div ref={viewerRef} className="w-full h-full" data-testid="epub-viewer" />

        <button
          className={`absolute left-0 top-0 bottom-0 w-16 flex items-center justify-start pl-2 transition-opacity duration-300 z-10 ${showControls ? "opacity-60" : "opacity-0"}`}
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          disabled={atStart}
          data-testid="button-prev-page"
          aria-label="Previous page"
          style={{ background: "transparent", border: "none", cursor: atStart ? "default" : "pointer" }}
        >
          <ChevronLeft className="w-6 h-6 text-muted-foreground" />
        </button>

        <button
          className={`absolute right-0 top-0 bottom-0 w-16 flex items-center justify-end pr-2 transition-opacity duration-300 z-10 ${showControls ? "opacity-60" : "opacity-0"}`}
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          disabled={atEnd}
          data-testid="button-next-page"
          aria-label="Next page"
          style={{ background: "transparent", border: "none", cursor: atEnd ? "default" : "pointer" }}
        >
          <ChevronRight className="w-6 h-6 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
