"use client";

import { createContext, useContext, useOptimistic } from "react";

const OptimisticDocumentContext = createContext(null);

export function OptimisticDocumentProvider({ document, children }) {
  const [optimisticDocument, dispatchOptimisticUpdate] = useOptimistic(
    document,
    (state, action) => {
      switch (action.type) {
        case "UPDATE":
          if (action.documentId !== state.id) {
            return state;
          }
          return { ...state, ...action.document };
        default:
          return state;
      }
    }
  );

  return (
    <OptimisticDocumentContext.Provider
      value={{ optimisticDocument, dispatchOptimisticUpdate }}
    >
      {children}
    </OptimisticDocumentContext.Provider>
  );
}

export function useOptimisticDocument() {
  const context = useContext(OptimisticDocumentContext);
  if (!context) {
    throw new Error(
      "useOptimisticDocument must be used within an OptimisticDocumentProvider"
    );
  }
  return context;
}
