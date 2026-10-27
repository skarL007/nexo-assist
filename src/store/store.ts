/**
 * Store Redux (Redux Toolkit).
 *  - chat: estado do chat do funcionário, alimentado pelo stream do agent (slice + thunks)
 *  - consoleApi: dados do console do analista com cache e polling (RTK Query)
 */
import { configureStore } from "@reduxjs/toolkit";
import { chatReducer } from "@/features/chat/chat-slice";
import { consoleApi } from "@/features/console/console-api";

export function makeStore() {
  return configureStore({
    reducer: {
      chat: chatReducer,
      [consoleApi.reducerPath]: consoleApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(consoleApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
