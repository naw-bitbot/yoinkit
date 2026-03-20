import { useState } from "react";
import { UrlField, Button } from "@yoinkit/ui";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  loading?: boolean;
}

export function UrlInput({ onSubmit, loading = false }: UrlInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (inputUrl: string) => {
    if (inputUrl.trim()) {
      onSubmit(inputUrl.trim());
      setUrl("");
    }
  };

  return (
    <div className="flex gap-3">
      <UrlField
        value={url}
        onChange={setUrl}
        onSubmit={handleSubmit}
        className="flex-1"
        disabled={loading}
      />
      <Button
        onClick={() => handleSubmit(url)}
        loading={loading}
        disabled={!url.trim()}
        size="lg"
      >
        Yoink!
      </Button>
    </div>
  );
}
