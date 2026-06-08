"use client";

import React from "react";
import { Loader2, Check, UploadCloud, FileText, Trash2 } from "lucide-react";
import { useDocuments } from "../hooks/useDocuments";

export default function DocumentLibrary() {
  const {
    documents,
    isUploading,
    uploadSuccess,
    dragActive,
    handleDrag,
    handleDrop,
    handleFileChange,
    handleDeleteDocument,
  } = useDocuments();

  return (
    <div className="documents-tab-view">
      <header>
        <h1>Document Library</h1>
        <p>Grounding corpus for RAG semantic search and policy analysis</p>
      </header>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`upload-dashed-zone ${dragActive ? "active" : ""}`}
      >
        {isUploading ? (
          <div className="upload-progress">
            <Loader2 className="animate-spin text-blue-600 mb-3" size={36} />
            <p className="bold-text">Extracting and Vectorizing...</p>
            <p className="muted-text">Generating embeddings through OpenRouter</p>
          </div>
        ) : uploadSuccess ? (
          <div className="upload-success">
            <div className="upload-success-icon">
              <Check size={24} className="stroke-[3px]" />
            </div>
            <p className="success-title">Document Ingested Successfully!</p>
            <p className="success-desc">Indexed for real-time strategic citation.</p>
          </div>
        ) : (
          <div className="upload-prompt-info">
            <UploadCloud size={40} className="text-slate-400 mb-3" />
            <p className="bold-text">Drag & drop your strategic PDFs here</p>
            <p className="muted-text">Accepts PDF, DOCX, TXT, Markdown (Max 15MB)</p>

            <label className="select-file-label">
              Select File
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Document Library Table */}
      <div className="documents-table-wrapper">
        <div className="table-header-row">
          <span className="count">{documents.length} Files Loaded</span>
          <span className="subtitle">Source Attribution Database</span>
        </div>

        <div className="table-scroll">
          <table className="documents-table">
            <thead>
              <tr>
                <th>Document Name</th>
                <th>Source</th>
                <th>Format</th>
                <th>Chunks</th>
                <th>Size</th>
                <th>Ingested At</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="doc-name">
                    <FileText size={14} className="text-slate-400 shrink-0" />
                    {doc.name}
                  </td>
                  <td>
                    <span className={`source-badge ${doc.source}`}>{doc.source}</span>
                  </td>
                  <td>
                    <span className="format-badge">{doc.kind}</span>
                  </td>
                  <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                    {doc.chunkCount}
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {(doc.characterCount / 1000).toFixed(1)}k chars
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {new Date(doc.uploadedAt).toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      onClick={() => handleDeleteDocument(doc.id, doc.name)}
                      className="delete-document-button"
                      title="Delete Document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
