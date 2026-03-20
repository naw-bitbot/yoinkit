import { WgetFlags } from "../lib/tauri";

interface CommandPreviewProps {
  url: string;
  flags: WgetFlags;
  savePath?: string;
}

export function CommandPreview({ url, flags, savePath }: CommandPreviewProps) {
  const buildCommand = (): string => {
    const parts = ["wget"];

    if (flags.recursive) parts.push("--recursive");
    if (flags.depth !== undefined) parts.push(`--level=${flags.depth}`);
    if (flags.convert_links) parts.push("--convert-links");
    if (flags.page_requisites) parts.push("--page-requisites");
    if (flags.no_parent) parts.push("--no-parent");
    if (flags.mirror) parts.push("--mirror");
    if (flags.accept) parts.push(`--accept=${flags.accept}`);
    if (flags.reject) parts.push(`--reject=${flags.reject}`);
    if (flags.limit_rate) parts.push(`--limit-rate=${flags.limit_rate}`);
    if (flags.wait !== undefined) parts.push(`--wait=${flags.wait}`);
    if (flags.random_wait) parts.push("--random-wait");
    if (flags.user) parts.push(`--user=${flags.user}`);
    if (flags.password) parts.push("--password=****");
    if (flags.header) flags.header.forEach((h) => parts.push(`--header="${h}"`));
    if (flags.continue_download) parts.push("--continue");
    if (flags.timestamping) parts.push("--timestamping");
    if (flags.output_document) parts.push(`--output-document=${flags.output_document}`);
    if (flags.user_agent) parts.push(`--user-agent="${flags.user_agent}"`);
    if (flags.no_check_certificate) parts.push("--no-check-certificate");
    if (flags.timeout !== undefined) parts.push(`--timeout=${flags.timeout}`);
    if (flags.tries !== undefined) parts.push(`--tries=${flags.tries}`);
    if (savePath) parts.push(`--directory-prefix=${savePath}`);
    if (url) parts.push(`"${url}"`);

    return parts.join(" \\\n  ");
  };

  return (
    <div className="bg-yoinkit-bg border border-yoinkit-muted/20 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-yoinkit-muted uppercase tracking-wider">Command Preview</span>
        <button
          onClick={() => navigator.clipboard.writeText(buildCommand())}
          className="text-xs text-yoinkit-primary hover:text-yoinkit-primary/80 transition-colors"
        >
          Copy
        </button>
      </div>
      <pre className="text-sm text-yoinkit-success font-mono whitespace-pre-wrap break-all">
        {buildCommand()}
      </pre>
    </div>
  );
}
