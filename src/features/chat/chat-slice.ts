/**
 * Estado do chat do funcionário.
 *
 * `conversation` é a verdade vinda do servidor. `live` é a resposta sendo
 * montada em tempo real (passos, cards e texto do stream); quando chega o
 * evento "done", o servidor manda a conversa atualizada e `live` é limpo.
 */
import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ChatStreamEvent, ConversationView, DraftAction } from "@/contracts/chat";
import type { Card, ChatMessage, TraceStep } from "@/domain/message";
import { apiFetch, fetchOrOffline, readNdjson } from "@/lib/api-client";

export interface LiveReply {
  steps: TraceStep[];
  cards: Card[];
  text: string;
}

interface ChatState {
  conversation: ConversationView | null;
  /** Mensagem do funcionário mostrada antes de o servidor confirmar. */
  optimisticText: string | null;
  live: LiveReply | null;
  sending: boolean;
  error: string | null;
  /** Texto que não chegou a ser gravado (o envio falhou): volta para o campo de mensagem. */
  unsentText: string | null;
}

const initialState: ChatState = { conversation: null, optimisticText: null, live: null, sending: false, error: null, unsentText: null };

export const loadConversation = createAsyncThunk("chat/load", () => apiFetch<ConversationView>("/api/chat"));

export const startNewConversation = createAsyncThunk("chat/new", () =>
  apiFetch<ConversationView>("/api/chat/new", { method: "POST" }),
);

export const resolveDraft = createAsyncThunk("chat/draft", ({ draftId, ...body }: { draftId: number } & DraftAction) =>
  apiFetch<ConversationView>(`/api/chat/drafts/${draftId}`, { method: "POST", body: JSON.stringify(body) }),
);

/** Envia a mensagem e repassa cada evento do stream para o reducer. */
export const sendMessage = createAsyncThunk("chat/send", async (text: string, { dispatch }) => {
  const response = await fetchOrOffline("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Não foi possível enviar.");
  }
  for await (const event of readNdjson<ChatStreamEvent>(response)) {
    dispatch(chatSlice.actions.streamEvent(event));
  }
});

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    streamEvent(state, { payload: event }: PayloadAction<ChatStreamEvent>) {
      switch (event.type) {
        case "employee_message":
          appendMessage(state, event.message);
          state.optimisticText = null;
          state.live = { steps: [], cards: [], text: "" };
          break;
        case "step":
          state.live?.steps.push(event.step);
          break;
        case "card":
          state.live?.cards.push(event.card);
          break;
        case "text":
          if (state.live) state.live.text += event.delta;
          break;
        case "done":
          state.conversation = event.conversation;
          state.live = null;
          break;
        case "error":
          state.error = event.message;
          state.live = null;
          // Falhou antes de gravar a mensagem: devolve o texto ao campo em vez de perdê-lo.
          if (state.optimisticText !== null) state.unsentText = state.optimisticText;
          state.optimisticText = null;
          break;
      }
    },
    dismissError(state) {
      state.error = null;
    },
    unsentRestored(state) {
      state.unsentText = null;
    },
    /** Atualização vinda do polling enquanto um analista atende. */
    conversationRefreshed(state, { payload }: PayloadAction<ConversationView>) {
      if (!state.sending) state.conversation = payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadConversation.fulfilled, (state, { payload }) => {
        state.conversation = payload;
      })
      .addCase(loadConversation.rejected, (state, { error }) => {
        state.error = error.message ?? "Não foi possível carregar a conversa.";
      })
      .addCase(sendMessage.pending, (state, { meta }) => {
        state.sending = true;
        state.error = null;
        state.optimisticText = meta.arg;
      })
      .addCase(sendMessage.fulfilled, (state) => {
        state.sending = false;
        state.optimisticText = null;
      })
      .addCase(sendMessage.rejected, (state, { error, meta }) => {
        state.sending = false;
        if (state.optimisticText !== null) state.unsentText = meta.arg;
        state.optimisticText = null;
        state.live = null;
        state.error = error.message ?? "Não foi possível enviar.";
      })
      .addCase(resolveDraft.fulfilled, (state, { payload }) => {
        state.conversation = payload;
      })
      // Erro de rascunho aparece no próprio card (o aviso no fim da página ficava atrás do campo de mensagem).
      .addCase(resolveDraft.rejected, () => {})
      .addCase(startNewConversation.fulfilled, (state, { payload }) => {
        state.conversation = payload;
        state.error = null;
      });
  },
});

function appendMessage(state: ChatState, message: ChatMessage) {
  if (!state.conversation) return;
  state.conversation.id = message.conversationId;
  state.conversation.messages.push(message);
  state.conversation.remainingMessages = Math.max(0, state.conversation.remainingMessages - 1);
}

export const { dismissError, conversationRefreshed, unsentRestored } = chatSlice.actions;
export const chatReducer = chatSlice.reducer;
