"use client";

import { createContext, useContext, useOptimistic } from "react";

const OptimisticVaultContext = createContext(null);

export function OptimisticVaultProvider({ documents, children }) {
  const [optimisticDocuments, dispatchOptimisticUpdate] = useOptimistic(
    documents,
    (state, action) => {
      switch (action.type) {
        case "CREATE":
          return [action.document, ...state];
        case "UPDATE":
          return state.map((doc) =>
            doc.id === action.documentId ? { ...doc, ...action.document } : doc
          );
        case "DELETE":
          return state.filter((doc) => doc.id !== action.documentId);
        default:
          return state;
      }
    }
  );

  return (
    <OptimisticVaultContext.Provider
      value={{ optimisticDocuments, dispatchOptimisticUpdate }}
    >
      {children}
    </OptimisticVaultContext.Provider>
  );
}

export function useOptimisticVault() {
  const context = useContext(OptimisticVaultContext);
  if (!context) {
    throw new Error(
      "useOptimisticVault must be used within an OptimisticVaultProvider"
    );
  }
  return context;
}
