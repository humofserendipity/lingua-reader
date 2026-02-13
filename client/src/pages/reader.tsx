import { useState, useCallback } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EpubReader } from "@/components/epub-reader";
import { FloatingToolbar, type AIAction } from "@/components/floating-toolbar";
import { AIPanel } from "@/components/ai-panel";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BookOpen, X } from "lucide-react";
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

  const handleTextSelect = useCallback((text: string, ctx: string) => {
    setSelectedText(text);
    setContext(ctx);
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
        <EpubReader
          bookUrl={`/api/books/${bookId}/file`}
          bookTitle={book.title}
          initialPosition={book.currentPosition || undefined}
          onPositionChange={handlePositionChange}
          onTextSelect={handleTextSelect}
        />

        {toolbarVisible && (
          <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-6 pointer-events-none">
            <div className="pointer-events-auto">
              <FloatingToolbar
                onAction={handleAction}
                onDismiss={() => setToolbarVisible(false)}
              />
            </div>
          </div>
        )}
      </div>

      <div
        className={`shrink-0 border-l bg-card/50 backdrop-blur-sm transition-all duration-300 overflow-hidden ${panelOpen ? "w-[380px]" : "w-0 border-l-0"}`}
      >
        {panelOpen && (
          <div className="w-[380px] h-full">
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
    </div>
  );
}
