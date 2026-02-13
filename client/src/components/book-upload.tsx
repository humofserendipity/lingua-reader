import { useState, useRef } from "react";
import { Upload, BookOpen, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface BookUploadProps {
  onUploadSuccess: (bookId: number) => void;
}

export function BookUpload({ onUploadSuccess }: BookUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".epub")) {
      toast({
        title: "Unsupported file type",
        description: "Please upload an EPUB file.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/books/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }

      const book = await res.json();
      toast({ title: "Book uploaded!", description: `"${book.title}" is ready to read.` });
      onUploadSuccess(book.id);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-md transition-colors p-8 text-center ${
        dragOver ? "border-primary bg-primary/5" : "border-border"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      data-testid="book-upload-dropzone"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub"
        className="hidden"
        onChange={handleInputChange}
        data-testid="input-file-upload"
      />
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          {uploading ? (
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {uploading ? "Uploading..." : "Drop your EPUB file here"}
          </p>
          <p className="text-xs text-muted-foreground">or click to browse</p>
        </div>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          data-testid="button-browse-files"
        >
          <FileText className="w-4 h-4 mr-2" />
          Choose File
        </Button>
      </div>
    </div>
  );
}
