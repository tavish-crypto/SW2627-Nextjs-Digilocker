"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createDocument } from "@/src/app/(vault)/documents/actions";
import { useOptimisticVault } from "@/src/components/optimistic-vault-provider";
import {
  validateFile,
  formatFileSize,
  detectDocumentType,
  extractTitleFromFileName,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from "@/src/lib/file-validation";

const initialState = {
  errors: null,
  data: null,
};

export function UploadDocumentForm() {
  const router = useRouter();
  const { dispatchOptimisticUpdate } = useOptimisticVault();
  const formRef = useRef(null);
  const fileInputRef = useRef(null);

  const [state, formAction, isServerPending] = useActionState(createDocument, initialState);

  // File selection & client-side validation state
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Form field state (auto-populated upon valid file selection)
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("PDF");
  const [sizeDisplay, setSizeDisplay] = useState("1.5 MB");
  const [description, setDescription] = useState("");

  // Direct cloud upload progress state
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("idle"); // idle | presigning | uploading | completing | done | error
  const [directUploadError, setDirectUploadError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const resetFormState = () => {
    formRef.current?.reset();
    setSelectedFile(null);
    setFileError(null);
    setTitle("");
    setDocType("PDF");
    setSizeDisplay("1.5 MB");
    setDescription("");
    setIsDirectUploading(false);
    setUploadProgress(0);
    setUploadStage("idle");
    setDirectUploadError(null);
  };

  // Clear form on server action success
  useEffect(() => {
    if (state.data && !state.errors) {
      // The server action has completed; reset local form state as a single transition.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetFormState();
    }
  }, [state.data, state.errors]);

  /**
   * Client-side file pre-flight validation.
   * Rejects oversized files (> 10MB) and unsupported types immediately
   * without initiating any network requests (PRD 5.6).
   */
  const handleFileSelection = (file) => {
    setSuccessMessage(null);
    setDirectUploadError(null);

    if (!file) {
      setSelectedFile(null);
      setFileError(null);
      return;
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      setFileError(validation.error);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // File is valid
    setFileError(null);
    setSelectedFile(file);

    // Auto-populate form fields from validated file metadata
    const detectedTitle = extractTitleFromFileName(file.name);
    const detectedType = validation.details?.detectedType || detectDocumentType(file.name, file.type) || "PDF";
    const formattedSize = validation.details?.formattedSize || formatFileSize(file.size);

    setTitle((prev) => (prev.trim() === "" ? detectedTitle : prev));
    setDocType(detectedType);
    setSizeDisplay(formattedSize);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  /**
   * Execute Direct Cloud Upload Flow (PRD Section 5.5)
   * 1. Pre-flight validation check
   * 2. POST /api/upload/presign -> get uploadUrl & objectKey
   * 3. Browser -> Cloud direct upload (PUT) with progress tracking
   * 4. POST /api/upload/complete -> save metadata to database
   */
  const handleDirectCloudUpload = async () => {
    if (!selectedFile) return;

    // 1. Strict pre-flight validation
    const validation = validateFile(selectedFile);
    if (!validation.valid) {
      setFileError(validation.error);
      return;
    }

    setIsDirectUploading(true);
    setUploadStage("presigning");
    setUploadProgress(15);
    setDirectUploadError(null);

    const activeTitle = title.trim() || extractTitleFromFileName(selectedFile.name) || "Uploaded Document";
    const activeType = docType;
    const activeSize = sizeDisplay || formatFileSize(selectedFile.size);

    // Optimistic UI update
    const tempId = `temp-${Date.now()}`;
    startTransition(() => {
      dispatchOptimisticUpdate({
        type: "CREATE",
        document: {
          id: tempId,
          title: activeTitle,
          type: activeType,
          size: activeSize,
          description: description || "Direct cloud upload in progress...",
          issuedOn: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        },
      });
    });

    try {
      // 2. Request temporary pre-signed URL from API
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type || "application/octet-stream",
          fileSize: selectedFile.size,
        }),
      });

      if (!presignRes.ok) {
        const errorData = await presignRes.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to generate cloud upload authorization.");
      }

      const presignData = await presignRes.json();
      const { uploadUrl, objectKey, provider } = presignData.data;

      setUploadStage("uploading");
      setUploadProgress(45);

      // 3. Upload file binary. Database fallback uses <=2 MiB chunks so it
      // works within serverless request limits; S3/GCP still use one direct PUT.
      if (provider === "database") {
        const chunkSize = 2 * 1024 * 1024;
        const totalChunks = Math.ceil(selectedFile.size / chunkSize);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
          const start = chunkIndex * chunkSize;
          const end = Math.min(start + chunkSize, selectedFile.size);
          const chunk = selectedFile.slice(start, end);
          const separator = uploadUrl.includes("?") ? "&" : "?";
          const chunkUrl = `${uploadUrl}${separator}chunkIndex=${chunkIndex}&totalChunks=${totalChunks}&fileSize=${selectedFile.size}`;

          const uploadRes = await fetch(chunkUrl, {
            method: "PUT",
            headers: {
              "Content-Type": selectedFile.type || "application/octet-stream",
            },
            body: chunk,
          });

          if (!uploadRes.ok) {
            const uploadError = await uploadRes.json().catch(() => ({}));
            throw new Error(uploadError.error || "Persistent upload failed. Please try again.");
          }

          const uploadedRatio = (chunkIndex + 1) / totalChunks;
          setUploadProgress(45 + Math.round(uploadedRatio * 35));
        }
      } else {
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": selectedFile.type || "application/octet-stream",
          },
          body: selectedFile,
        });

        if (!uploadRes.ok) {
          throw new Error("Direct cloud upload failed. Please try again.");
        }
      }

      setUploadStage("completing");
      setUploadProgress(85);

      // 4. Save metadata to vault database
      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey,
          fileName: selectedFile.name,
          contentType: selectedFile.type || "application/octet-stream",
          fileSize: selectedFile.size,
        }),
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Failed to record uploaded document metadata.");
      }

      const completeData = await completeRes.json();
      setUploadProgress(100);
      setUploadStage("done");
      setSuccessMessage(`"${activeTitle}" uploaded successfully to your vault!`);

      // Refresh server-side data
      router.refresh();
      resetFormState();
    } catch (err) {
      const fallbackMessage = err instanceof TypeError && err.message === "Failed to fetch"
        ? "Unable to upload the document. Please try again."
        : err?.message || "Unable to upload the document. Please try again.";

      setUploadStage("error");
      setDirectUploadError(fallbackMessage);
      setIsDirectUploading(false);
    }
  };

  const handleSubmit = (event) => {
    // If a physical file is selected, handle via the 2-step direct cloud upload pipeline
    if (selectedFile) {
      event.preventDefault();
      handleDirectCloudUpload();
      return;
    }

    // Otherwise, dispatch optimistic update and let standard Server Action proceed
    const form = event.currentTarget;
    const formData = new FormData(form);
    const formTitle = formData.get("title");
    const formType = formData.get("type");
    const formSize = formData.get("size");
    const formDescription = formData.get("description");

    startTransition(() => {
      dispatchOptimisticUpdate({
        type: "CREATE",
        document: {
          id: `temp-${Date.now()}`,
          title: formTitle,
          type: formType,
          size: formSize,
          description: formDescription,
          issuedOn: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        },
      });
    });
  };

  const isPending = isServerPending || isDirectUploading;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {/* Top Form Alert (Server Action Errors) */}
      {state.errors?._form?.[0] && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
        >
          {state.errors._form[0]}
        </div>
      )}

      {/* Direct Cloud Upload Error */}
      {directUploadError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 flex items-center justify-between"
        >
          <span>{directUploadError}</span>
          <button
            type="button"
            onClick={() => setDirectUploadError(null)}
            className="text-red-700 hover:text-red-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Upload Success Alert */}
      {successMessage && (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400 flex items-center justify-between"
        >
          <span>✓ {successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Drag and Drop Zone (PRD Section 5.4, 7) */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all ${
          dragActive
            ? "border-[#0066b3] bg-[#e5f2fc]/60 scale-[1.01]"
            : fileError
            ? "border-red-400 bg-red-50/50 dark:bg-red-950/10"
            : "border-black/15 dark:border-white/20 hover:border-[#0066b3] bg-foreground/[0.02]"
        }`}
      >
        <input
          ref={fileInputRef}
          id="file-upload"
          name="file"
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={(e) => handleFileSelection(e.target.files?.[0])}
          className="sr-only"
        />

        {!selectedFile ? (
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#0066b3]/10 text-[#0066b3] flex items-center justify-center font-bold text-lg">
              ↑
            </div>
            <div>
              <label
                htmlFor="file-upload"
                className="cursor-pointer text-sm font-semibold text-[#0066b3] hover:underline"
              >
                Choose a document
              </label>
              <span className="text-sm text-foreground/75"> or drag and drop here</span>
            </div>
            <p className="text-xs text-foreground/60">
              Supported formats: PDF, DOCX, JPG, PNG, WEBP, XML, JSON
            </p>
            <p className="text-xs font-medium text-foreground/70">
              Maximum file size: 10 MB per file
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-md border border-line shadow-xs">
            <div className="flex items-center space-x-3 text-left">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-sm bg-[#0066b3] text-white text-xs font-bold">
                {docType}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-foreground/65">
                  {formatFileSize(selectedFile.size)} • Direct Cloud Upload Ready
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setSelectedFile(null);
                setFileError(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 px-2 py-1 rounded"
            >
              Remove
            </button>
          </div>
        )}

        {/* Client-Side Pre-Flight Validation Error Banner */}
        {fileError && (
          <div
            role="alert"
            className="mt-3 p-2.5 rounded-md bg-red-100 text-red-800 text-xs font-medium flex items-center justify-center space-x-2 animate-shake"
          >
            <span>⚠️</span>
            <span>{fileError}</span>
          </div>
        )}
      </div>

      {/* Upload Progress Bar */}
      {isDirectUploading && (
        <div className="space-y-1.5 p-3 rounded-md bg-[#e5f2fc] dark:bg-neutral-900 border border-[#91c1e4] text-xs">
          <div className="flex justify-between font-medium text-[#004b87] dark:text-blue-300">
            <span>
              {uploadStage === "presigning" && "Requesting pre-signed cloud URL..."}
              {uploadStage === "uploading" && "Uploading directly to Cloud Storage..."}
              {uploadStage === "completing" && "Finalizing document metadata in vault..."}
              {uploadStage === "done" && "Upload complete!"}
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-blue-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#0066b3] h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Metadata Input Fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label
            htmlFor="title"
            className="text-xs font-medium text-foreground/75"
          >
            Document Title *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={Boolean(state.errors?.title)}
            aria-describedby={state.errors?.title ? "title-error" : undefined}
            placeholder="e.g. Passport, Tax Certificate"
            className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 dark:border-white/20 ${
              state.errors?.title
                ? "border-red-500 dark:border-red-500 focus:ring-red-400/30"
                : "border-black/15 dark:border-white/20"
            }`}
          />
          {state.errors?.title?.[0] && (
            <p id="title-error" className="text-xs text-red-600 dark:text-red-400">
              {state.errors.title[0]}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="type"
            className="text-xs font-medium text-foreground/75"
          >
            Format / Type
          </label>
          <select
            id="type"
            name="type"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            aria-invalid={Boolean(state.errors?.type)}
            aria-describedby={state.errors?.type ? "type-error" : undefined}
            className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 dark:border-white/20 ${
              state.errors?.type
                ? "border-red-500 dark:border-red-500 focus:ring-red-400/30"
                : "border-black/15 dark:border-white/20"
            }`}
          >
            <option value="PDF" className="dark:bg-neutral-900">PDF</option>
            <option value="DOCX" className="dark:bg-neutral-900">DOCX</option>
            <option value="JPG" className="dark:bg-neutral-900">JPG</option>
            <option value="PNG" className="dark:bg-neutral-900">PNG</option>
            <option value="WEBP" className="dark:bg-neutral-900">WEBP</option>
            <option value="XML" className="dark:bg-neutral-900">XML</option>
            <option value="JSON" className="dark:bg-neutral-900">JSON</option>
          </select>
          {state.errors?.type?.[0] && (
            <p id="type-error" className="text-xs text-red-600 dark:text-red-400">
              {state.errors.type[0]}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="size"
            className="text-xs font-medium text-foreground/75"
          >
            File Size
          </label>
          <input
            id="size"
            name="size"
            type="text"
            value={sizeDisplay}
            onChange={(e) => setSizeDisplay(e.target.value)}
            placeholder="e.g. 2.1 MB"
            aria-invalid={Boolean(state.errors?.size)}
            aria-describedby={state.errors?.size ? "size-error" : undefined}
            className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 dark:border-white/20 ${
              state.errors?.size
                ? "border-red-500 dark:border-red-500 focus:ring-red-400/30"
                : "border-black/15 dark:border-white/20"
            }`}
          />
          {state.errors?.size?.[0] && (
            <p id="size-error" className="text-xs text-red-600 dark:text-red-400">
              {state.errors.size[0]}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="description"
          className="text-xs font-medium text-foreground/75"
        >
          Description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the document"
          aria-invalid={Boolean(state.errors?.description)}
          aria-describedby={
            state.errors?.description ? "description-error" : undefined
          }
          className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 dark:border-white/20 ${
            state.errors?.description
              ? "border-red-500 dark:border-red-500 focus:ring-red-400/30"
              : "border-black/15 dark:border-white/20"
          }`}
        />
        {state.errors?.description?.[0] && (
          <p
            id="description-error"
            className="text-xs text-red-600 dark:text-red-400"
          >
            {state.errors.description[0]}
          </p>
        )}
      </div>

      <div className="flex justify-between items-center pt-2">
        <div className="text-xs text-foreground/60">
          {selectedFile ? (
            <span className="text-[#0066b3] font-medium">
              Ready to upload: {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </span>
          ) : (
            <span>Attach a file above or enter details manually</span>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending || Boolean(fileError)}
          className="button-primary text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending
            ? isDirectUploading
              ? "Uploading to Cloud..."
              : "Saving to Vault..."
            : selectedFile
            ? "Upload Document to Vault"
            : "Save Document"}
        </button>
      </div>
    </form>
  );
}
