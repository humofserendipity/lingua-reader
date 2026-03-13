import { useState, useCallback, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EpubReader } from "@/components/epub-reader";
import { FloatingToolbar, type AIAction } from "@/components/floating-toolbar";
import { AIPanel } from "@/components/ai-panel";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BookOpen, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import type { Book } from "@shared/schema";

export default function ReaderPage() {
  const [, params] = useRoute("/reader/:id");
  const bookId = params?.id ? parseInt(params.id) : null;

  const [selectedText, setSelectedText] = useState("");
  const [context, setContext] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState("");
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarCoords, setToolbarCoords] = useState<{ x: number; y: number } | undefined>();
  const [panelWidth, setPanelWidth] = useState(380);
  const [currentChapter, setCurrentChapter] = useState("");
  const lastPositionRef = useRef<{ position: string; chapter?: string } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [fileError, setFileError] = useState<string | null>(null);

  const { data: book, isLoading } = useQuery<Book>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
  });

  const updatePositionCache = useCallback((position: string, chapter?: string) => {
    queryClient.setQueryData(["/api/books", bookId], (old: Book | undefined) => {
      if (!old) return old;
      return { ...old, currentPosition: position, currentChapter: chapter ?? old.currentChapter };
    });
  }, [bookId]);

  const persistPositionFetch = useCallback((position: string, chapter?: string) => {
    fetch(`/api/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPosition: position, currentChapter: chapter }),
      keepalive: true,
      credentials: "include",
    });
  }, [bookId]);

  const savePositionMutation = useMutation({
    mutationFn: async ({ position, chapter }: { position: string; chapter?: string }) => {
      await apiRequest("PATCH", `/api/books/${bookId}`, {
        currentPosition: position,
        currentChapter: chapter,
      });
    },
    onSuccess: (_, { position, chapter }) => updatePositionCache(position, chapter),
  });

  const handleTextSelect = useCallback((text: string, ctx: string, coords?: { x: number; y: number }) => {
    setSelectedText(text);
    setContext(ctx);
    setToolbarCoords(coords);
    setToolbarVisible(true);
  }, []);

  const handlePositionChange = useCallback((position: string, chapter?: string) => {
    if (chapter) setCurrentChapter(chapter);
    lastPositionRef.current = { position, chapter };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePositionMutation.mutate({ position, chapter });
    }, 2000);
  }, [savePositionMutation]);

  // Save position whenever navigating away (SPA navigation or tab close)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const last = lastPositionRef.current;
      if (!bookId || !last) return;
      updatePositionCache(last.position, last.chapter);
      persistPositionFetch(last.position, last.chapter);
    };
  }, [bookId, updatePositionCache, persistPositionFetch]);

  // Also save on browser tab/window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const last = lastPositionRef.current;
      if (!bookId || !last) return;
      persistPositionFetch(last.position, last.chapter);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [bookId, persistPositionFetch]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      const delta = dragStartXRef.current - e.clientX;
      const newWidth = Math.max(280, Math.min(600, dragStartWidthRef.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [panelWidth]);

  const handleAction = useCallback(async (action: AIAction) => {
    setToolbarVisible(false);

    if (action === "save-word" || action === "save-sentence") {
      setPanelOpen(true);
      setAiLoading(true);
      setAiAction(action);
      try {
        const res = await apiRequest("POST", "/api/ai/save-vocab", {
          text: selectedText,
          context,
          type: action === "save-word" ? "word" : "sentence",
          bookId,
          chapter: currentChapter || null,
        });
        const data = await res.json();
        setAiResponse(data.message || "Saved successfully!");
        queryClient.invalidateQueries({ queryKey: ["/api/vocab"] });
        toast({ title: action === "save-word" ? "Word saved!" : "Sentence saved!" });
      } catch (err: any) {
        setAiResponse("Failed to save. Please try again.");
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setAiLoading(false);
      }
      return;
    }

    setPanelOpen(true);
    setAiLoading(true);
    setAiAction(action);
    setAiResponse("");

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: selectedText, context, action }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullText += data.content;
                  setAiResponse(fullText);
                }
                if (data.error) {
                  setAiResponse(data.error);
                }
              } catch {
              }
            }
          }
        }
      }
    } catch (err: any) {
      setAiResponse("Failed to get AI response. Please try again.");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }, [selectedText, context, bookId, toast, currentChapter]);

  const handleSaveFromPanel = useCallback(async (type: "word" | "sentence") => {
    if (!selectedText) return;
    setAiLoading(true);
    setAiAction(type === "word" ? "save-word" : "save-sentence");
    try {
      const res = await apiRequest("POST", "/api/ai/save-vocab", {
        text: selectedText,
        context,
        type,
        bookId,
        chapter: currentChapter || null,
      });
      const data = await res.json();
      setAiResponse(data.message || "Saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["/api/vocab"] });
      toast({ title: type === "word" ? "Word saved!" : "Sentence saved!" });
    } catch (err: any) {
      setAiResponse("Failed to save. Please try again.");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }, [selectedText, context, bookId, currentChapter, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <BookOpen className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">Book not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      <div className="flex-1 min-w-0 relative">
        {fileError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <p className="text-destructive font-medium">{fileError}</p>
            <p className="text-muted-foreground text-sm">Re-upload the book to fix this.</p>
            <Button variant="outline" onClick={() => navigate("/")}>Back to Library</Button>
          </div>
        ) : (
          <EpubReader
            bookUrl={`/api/books/${bookId}/file`}
            bookTitle={book.title}
            initialPosition={book.currentPosition || undefined}
            onPositionChange={handlePositionChange}
            onTextSelect={handleTextSelect}
            onError={setFileError}
          />
        )}

        {toolbarVisible && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setToolbarVisible(false)} />
            {toolbarCoords ? (
              <FloatingToolbar
                onAction={handleAction}
                onDismiss={() => setToolbarVisible(false)}
                coords={toolbarCoords}
              />
            ) : (
              <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-6 pointer-events-none">
                <div className="pointer-events-auto">
                  <FloatingToolbar
                    onAction={handleAction}
                    onDismiss={() => setToolbarVisible(false)}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {panelOpen && (
        <>
          <div
            className="shrink-0 w-1.5 cursor-col-resize bg-border/50 hover-elevate active-elevate-2 transition-colors z-30"
            onMouseDown={handleResizeStart}
            data-testid="resize-handle"
          />
          <div
            className="shrink-0 bg-card/50 backdrop-blur-sm overflow-hidden"
            style={{ width: panelWidth }}
          >
            <div className="h-full" style={{ width: panelWidth }}>
              <AIPanel
                bookId={bookId || undefined}
                selectedText={selectedText}
                context={context}
                aiResponse={aiResponse}
                aiLoading={aiLoading}
                aiAction={aiAction}
                currentChapter={currentChapter}
                onClose={() => setPanelOpen(false)}
                onSaveVocab={handleSaveFromPanel}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
