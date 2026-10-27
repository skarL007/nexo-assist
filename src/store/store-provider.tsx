"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore } from "./store";

/** Um store por aba do navegador (padrão recomendado para o App Router). */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);
  return <Provider store={store}>{children}</Provider>;
}
