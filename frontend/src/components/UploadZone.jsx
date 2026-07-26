import { useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";

export default function UploadZone({
  label,
  accept,
  onFile,
  file,
  onClear,
  multiple = false,
  onFiles,
  testid,
}) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    if (multiple) {
      onFiles && onFiles(Array.from(files));
    } else {
      onFile && onFile(files[0]);
    }
  };

  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
        {label}
      </div>
      {file && !multiple ? (
        <div
          className="border border-zinc-800 rounded-md bg-zinc-900/60 px-4 py-3 flex items-center justify-between"
          data-testid={`${testid}-selected`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm truncate">{file.name}</div>
              <div className="text-[11px] text-zinc-500 font-mono">
                {(file.size / 1024).toFixed(1)} KB
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            data-testid={`${testid}-clear`}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      ) : (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          data-testid={testid}
          className={`border-2 border-dashed rounded-md px-6 py-8 text-center cursor-pointer transition-colors ${
            drag
              ? "border-white bg-zinc-900"
              : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500"
          }`}
        >
          <UploadCloud className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
          <div className="text-sm">Drag &amp; drop or click to browse</div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1">
            {accept}
          </div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={accept}
            multiple={multiple}
            onChange={(e) => handleFiles(e.target.files)}
            data-testid={`${testid}-input`}
          />
        </div>
      )}
    </div>
  );
}
