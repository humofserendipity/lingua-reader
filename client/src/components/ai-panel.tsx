import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Languages, BookText, GraduationCap, BookmarkPlus, X, BookOpen, Sparkles, Save, ChevronDown, ChevronRight, ALargeSmall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { VocabItem } from "@shared/schema";

const LS_PANEL_FONT = "ai-panel:fontSize";
function getSavedPanelFont(): number {
  try { return JSON.parse(localStorage.getItem(LS_PANEL_FONT) || "14"); } catch { return 14; }
}

interface AIPanelProps {
  bookId?: number;
  selectedText: string;
  context: string;
  aiResponse: string;
  aiLoading: boolean;
  aiAction: string;
  currentChapter?: string;
  onClose: () => void;
  onSaveVocab?: (type: "word" | "sentence") => void;
}

export function AIPanel({
  bookId,
  selectedText,
  context,
  aiResponse,
  aiLoading,
  aiAction,
  currentChapter,
  onClose,
  onSaveVocab,
}: AIPanelProps) {
  const [activeTab, setActiveTab] = useState("ai");
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());
  const [panelFontSize, setPanelFontSize] = useState<number>(getSavedPanelFont);
  const { toast } = useToast();

  const handlePanelFontChange = (v: number) => {
    setPanelFontSize(v);
    localStorage.setItem(LS_PANEL_FONT, JSON.stringify(v));
  };

  const { data: vocabItems = [], isLoading: vocabLoading } = useQuery<VocabItem[]>({
    queryKey: ["/api/vocab"],
  });

  const deleteVocabMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/vocab/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocab"] });
      toast({ title: "Removed from vocabulary" });
    },
  });

  const vocabByChapter = useMemo(() => {
    const groups: Record<string, VocabItem[]> = {};
    for (const item of vocabItems) {
      const key = item.chapter || "Uncategorized";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [vocabItems]);

  const toggleChapter = (chapter: string) => {
    setCollapsedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapter)) {
        next.delete(chapter);
      } else {
        next.add(chapter);
      }
      return next;
    });
  };

  const getActionIcon = () => {
    switch (aiAction) {
      case "translate": return <Languages className="w-4 h-4" />;
      case "quick-grammar": return <BookText className="w-4 h-4" />;
      case "deep-grammar": return <GraduationCap className="w-4 h-4" />;
      case "save-word":
      case "save-sentence": return <BookmarkPlus className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getActionLabel = () => {
    switch (aiAction) {
      case "translate": return "Translation";
      case "quick-grammar": return "Quick Grammar";
      case "deep-grammar": return "Deep Grammar";
      case "save-word": return "Save Word";
      case "save-sentence": return "Save Sentence";
      default: return "AI Response";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new": return <Badge variant="secondary">New</Badge>;
      case "learning": return <Badge variant="default">Learning</Badge>;
      case "known": return <Badge variant="outline">Known</Badge>;
      default: return null;
    }
  };

  const showSaveButton = !aiLoading && aiResponse && selectedText &&
    (aiAction === "translate" || aiAction === "quick-grammar" || aiAction === "deep-grammar");

  return (
    <div className="h-full flex flex-col bg-card/30">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="flex items-center justify-between gap-4 px-3 py-2 border-b">
          <TabsList className="h-8">
            <TabsTrigger value="ai" className="text-xs gap-1.5" data-testid="tab-ai">
              <Sparkles className="w-3 h-3" />
              AI
            </TabsTrigger>
            <TabsTrigger value="vocab" className="text-xs gap-1.5" data-testid="tab-vocab">
              <BookOpen className="w-3 h-3" />
              Vocab ({vocabItems.length})
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" title="Text size" data-testid="button-panel-font-size">
                  <ALargeSmall className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 space-y-3">
                <Label className="text-xs font-medium">Text Size: {panelFontSize}px</Label>
                <Slider
                  min={11}
                  max={20}
                  step={1}
                  value={[panelFontSize]}
                  onValueChange={([v]) => handlePanelFontChange(v)}
                />
              </PopoverContent>
            </Popover>
            <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-panel">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="ai" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4" style={{ fontSize: panelFontSize }}>
              {selectedText && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Selected Text
                  </div>
                  <Card className="p-3">
                    <p className="font-serif text-sm leading-relaxed">{selectedText}</p>
                  </Card>
                </div>
              )}

              {(aiLoading || aiResponse) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary uppercase tracking-wider">
                    {getActionIcon()}
                    {getActionLabel()}
                  </div>
                  {aiLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-4 w-3/5" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ) : (
                    <Card className="p-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                        <ReactMarkdown>{aiResponse}</ReactMarkdown>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {showSaveButton && onSaveVocab && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onSaveVocab("word")}
                    data-testid="button-save-as-word"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save as Word
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onSaveVocab("sentence")}
                    data-testid="button-save-as-sentence"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save as Sentence
                  </Button>
                </div>
              )}

              {!selectedText && !aiResponse && !aiLoading && (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Languages className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Select text to get started</p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      Highlight a word or passage in the reader to translate, analyze grammar, or save vocabulary.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="vocab" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {vocabLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : vocabItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <BookmarkPlus className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">No vocabulary saved yet</p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      Select text and use the toolbar or AI panel to save items to your vocabulary list.
                    </p>
                  </div>
                </div>
              ) : (
                Object.entries(vocabByChapter).map(([chapter, items]) => (
                  <div key={chapter} className="space-y-2">
                    <button
                      className="flex items-center gap-1.5 w-full text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-1"
                      onClick={() => toggleChapter(chapter)}
                      data-testid={`button-toggle-chapter-${chapter}`}
                    >
                      {collapsedChapters.has(chapter) ? (
                        <ChevronRight className="w-3 h-3 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3 h-3 shrink-0" />
                      )}
                      <span className="truncate">{chapter}</span>
                      <Badge variant="secondary" className="ml-auto text-[10px]">{items.length}</Badge>
                    </button>
                    {!collapsedChapters.has(chapter) && (
                      <div className="space-y-2 pl-1">
                        {items.map((item) => (
                          <Card key={item.id} className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {item.type}
                                </Badge>
                                {getStatusBadge(item.reviewStatus)}
                                {item.partOfSpeech && (
                                  <span className="text-xs text-muted-foreground italic">{item.partOfSpeech}</span>
                                )}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="shrink-0"
                                onClick={() => deleteVocabMutation.mutate(item.id)}
                                data-testid={`button-delete-vocab-${item.id}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            <p className="font-serif text-sm font-medium">{item.originalText}</p>
                            {item.translation && (
                              <p className="text-sm text-muted-foreground">{item.translation}</p>
                            )}
                            {item.grammarNotes && (
                              <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2 mt-2">
                                {item.grammarNotes}
                              </p>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
