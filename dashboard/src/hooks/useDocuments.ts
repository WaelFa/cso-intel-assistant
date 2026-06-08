import { useDashboard } from "../context/DashboardContext";

export function useDocuments() {
  const {
    documents,
    isUploading,
    uploadSuccess,
    dragActive,
    setDragActive,
    fetchDocuments,
    handleDrag,
    handleDrop,
    handleFileChange,
    uploadFile,
    handleDeleteDocument,
  } = useDashboard();

  return {
    documents,
    isUploading,
    uploadSuccess,
    dragActive,
    setDragActive,
    fetchDocuments,
    handleDrag,
    handleDrop,
    handleFileChange,
    uploadFile,
    handleDeleteDocument,
  };
}
