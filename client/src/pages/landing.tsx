import { BookOpen, Languages, Brain, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-serif text-lg font-semibold tracking-tight">LinguaReader</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/api/login">
              <Button data-testid="button-login">Sign In</Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              Read books.{" "}
              <span className="text-primary">Learn languages.</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-lg leading-relaxed">
              Open any EPUB in Spanish and get instant AI-powered translations,
              grammar breakdowns, and vocabulary tracking — all in one beautiful reader.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a href="/api/login">
                <Button size="lg" data-testid="button-get-started">
                  Get Started Free
                </Button>
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                AI-powered by Claude
              </span>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="relative rounded-md overflow-hidden border bg-card p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <span className="font-serif text-sm font-medium">Harry Potter y la piedra filosofal</span>
                </div>
                <p className="font-serif text-base leading-relaxed text-foreground/90">
                  El señor Dursley era el director de una empresa llamada Grunnings, que fabricaba taladros.
                  Era un hombre corpulento y <span className="bg-primary/20 text-primary font-medium px-1 rounded-sm">apenas tenía cuello</span>,
                  aunque tenía un bigote muy largo.
                </p>
                <div className="mt-4 p-3 rounded-md bg-muted/50 border text-sm space-y-1.5">
                  <div className="flex items-center gap-2 text-primary font-medium text-xs uppercase tracking-wider">
                    <Languages className="w-3.5 h-3.5" />
                    Translation
                  </div>
                  <p className="text-foreground/80">"barely had a neck"</p>
                  <p className="text-muted-foreground text-xs">
                    apenas (barely) + tenía (had, imperfect of tener) + cuello (neck)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <h2 className="font-serif text-3xl font-bold tracking-tight">
              Everything you need to learn from reading
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Powered by Claude AI, LinguaReader turns every book into a personalized language lesson.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Languages className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Instant Translation</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Highlight any word or passage and get immediate, context-aware translations powered by AI.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Grammar Analysis</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Get quick or deep grammatical breakdowns — conjugations, tenses, mood, and why each form is used.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Flashcard Review</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Save words and sentences, then review them with built-in flashcards that track your progress.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>LinguaReader</span>
          </div>
          <span>Built with Claude AI</span>
        </div>
      </footer>
    </div>
  );
}
