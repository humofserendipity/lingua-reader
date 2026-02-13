import { useState, useCallback } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EpubReader } from "@/components/epub-reader";
import { FloatingToolbar, type AIAction } from "@/components/floating-toolbar";
import { AIPanel } from "@/components/ai-panel";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PanelRightOpen, PanelRightClose, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Book } from "@shared/schema";

export default function ReaderPage() {
  const [, params] = useRoute("/reader/:id");
  const bookId = params?.id ? parseInt(params.id) : null;

  const [selectedText, setSelectedText] = useState("");
  const [context, setContext] = useState("");
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState("");
  const { toast } = useToast();

  const { data: book, isLoading } = useQuery<Book>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
  });

  const savePositionMutation = useMutation({
    mutationFn: async ({ position, chapter }: { position: string; chapter?: string }) => {
      await apiRequest("PATCH", `/api/books/${bookId}`, {
        currentPosition: position,
        currentChapter: chapter,
      });
    },
  });

  const handleTextSelect = useCallback((text: string, ctx: string, rect: DOMRect) => {
    setSelectedText(text);
    setContext(ctx);
    setToolbarPos({ x: rect.x + rect.width / 2, y: rect.y + rect.height });
    setToolbarVisible(true);
  }, []);

  const handlePositionChange = useCallback((position: string, chapter?: string) => {
    savePositionMutation.mutate({ position, chapter });
  }, [savePositionMutation]);

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
                // skip malformed JSON
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
  }, [selectedText, context, bookId, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <BookOpen className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">Book not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full relative">
      <div className={`flex-1 relative transition-all duration-300 ${panelOpen ? "mr-0" : ""}`}>
        <div className="absolute top-2 right-2 z-10">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPanelOpen(!panelOpen)}
            data-testid="button-toggle-panel"
          >
            {panelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
        </div>

        <EpubReader
          bookUrl={`/api/books/${bookId}/file`}
          initialPosition={book.currentPosition || undefined}
          onPositionChange={handlePositionChange}
          onTextSelect={handleTextSelect}
        />

        <FloatingToolbar
          position={toolbarPos}
          visible={toolbarVisible}
          onAction={handleAction}
        />
      </div>

      {panelOpen && (
        <div className="w-[340px] border-l shrink-0 h-full">
          <AIPanel
            bookId={bookId || undefined}
            selectedText={selectedText}
            context={context}
            aiResponse={aiResponse}
            aiLoading={aiLoading}
            aiAction={aiAction}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
