import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  RotateCcw,
  Check,
  X,
  BookOpen,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VocabItem } from "@shared/schema";

export default function FlashcardsPage() {
  const [, navigate] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });

  const { data: vocabItems = [], isLoading } = useQuery<VocabItem[]>({
    queryKey: ["/api/vocab"],
  });

  const reviewItems = useMemo(() => {
    return vocabItems.filter((item) => item.reviewStatus !== "known");
  }, [vocabItems]);

  const updateReviewMutation = useMutation({
    mutationFn: async ({ id, correct }: { id: number; correct: boolean }) => {
      await apiRequest("POST", `/api/vocab/${id}/review`, { correct });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocab"] });
    },
  });

  const currentCard = reviewItems[currentIndex];
  const totalReviewable = reviewItems.length;
  const progress = totalReviewable > 0 ? ((sessionStats.correct + sessionStats.incorrect) / totalReviewable) * 100 : 0;

  const handleAnswer = (correct: boolean) => {
    if (!currentCard) return;
    updateReviewMutation.mutate({ id: currentCard.id, correct });
    setSessionStats((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }));
    setShowAnswer(false);
    if (currentIndex < totalReviewable - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const resetSession = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setSessionStats({ correct: 0, incorrect: 0 });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b backdrop-blur-md bg-background/80">
          <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
            <Button size="icon" variant="ghost" onClick={() => navigate("/")} data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="font-serif font-semibold">Flashcards</span>
            <ThemeToggle />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-8">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b backdrop-blur-md bg-background/80">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Button size="icon" variant="ghost" onClick={() => navigate("/")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <span className="font-serif font-semibold">Flashcards</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {totalReviewable === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <GraduationCap className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-serif font-semibold">No cards to review</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                {vocabItems.length === 0
                  ? "Save words and sentences while reading to create flashcards."
                  : "All items marked as known! Great job!"}
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/")} data-testid="button-go-reading">
              <BookOpen className="w-4 h-4 mr-2" />
              Go Reading
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  Card {currentIndex + 1} of {totalReviewable}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    <span className="text-green-600 dark:text-green-400 font-medium">{sessionStats.correct}</span>
                    {" / "}
                    <span className="text-red-600 dark:text-red-400 font-medium">{sessionStats.incorrect}</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={resetSession} data-testid="button-reset-session">
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Reset
                  </Button>
                </div>
              </div>
              <Progress value={progress} className="h-1.5" data-testid="progress-bar" />
            </div>

            {currentCard && (
              <Card className="p-6 sm:p-8 min-h-[280px] flex flex-col" data-testid="flashcard">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="text-xs">{currentCard.type}</Badge>
                  <Badge variant="secondary" className="text-xs">{currentCard.reviewStatus}</Badge>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                  <p className="font-serif text-xl sm:text-2xl font-medium leading-relaxed" data-testid="text-flashcard-front">
                    {currentCard.originalText}
                  </p>

                  {showAnswer && (
                    <div className="space-y-3 w-full border-t pt-4 mt-2" data-testid="flashcard-answer">
                      {currentCard.translation && (
                        <p className="text-lg text-muted-foreground">{currentCard.translation}</p>
                      )}
                      {currentCard.partOfSpeech && (
                        <p className="text-sm text-muted-foreground italic">{currentCard.partOfSpeech}</p>
                      )}
                      {currentCard.grammarNotes && (
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
                          {currentCard.grammarNotes}
                        </p>
                      )}
                      {currentCard.exampleSentence && (
                        <p className="text-sm font-serif italic text-foreground/70">
                          "{currentCard.exampleSentence}"
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3 pt-4 mt-auto">
                  {!showAnswer ? (
                    <Button onClick={() => setShowAnswer(true)} data-testid="button-show-answer">
                      <Eye className="w-4 h-4 mr-2" />
                      Show Answer
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleAnswer(false)}
                        data-testid="button-still-learning"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Still Learning
                      </Button>
                      <Button
                        onClick={() => handleAnswer(true)}
                        data-testid="button-got-it"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Got It
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            )}

            <div className="flex items-center justify-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                disabled={currentIndex === 0}
                onClick={() => { setCurrentIndex((i) => i - 1); setShowAnswer(false); }}
                data-testid="button-prev-card"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={currentIndex >= totalReviewable - 1}
                onClick={() => { setCurrentIndex((i) => i + 1); setShowAnswer(false); }}
                data-testid="button-next-card"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
