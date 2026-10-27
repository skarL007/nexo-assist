/**
 * API do console do analista com RTK Query: cache, estados de carregamento
 * e polling prontos. As mutações invalidam o cache e a lista se atualiza sozinha.
 */
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ConsoleConversationDetail, ConsoleConversationSummary } from "@/contracts/chat";

export const consoleApi = createApi({
  reducerPath: "consoleApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/console" }),
  tagTypes: ["Conversation"],
  endpoints: (build) => ({
    listConversations: build.query<ConsoleConversationSummary[], void>({
      query: () => "/conversations",
      providesTags: ["Conversation"],
    }),
    getConversation: build.query<ConsoleConversationDetail, string>({
      query: (id) => `/conversations/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Conversation", id }],
    }),
    conversationAction: build.mutation<ConsoleConversationDetail, { id: string; action: "assume" | "release" | "close" }>({
      query: ({ id, action }) => ({ url: `/conversations/${id}`, method: "POST", body: { action } }),
      invalidatesTags: ["Conversation"],
    }),
    sendAnalystMessage: build.mutation<ConsoleConversationDetail, { id: string; text: string }>({
      query: ({ id, text }) => ({ url: `/conversations/${id}/messages`, method: "POST", body: { text } }),
      invalidatesTags: ["Conversation"],
    }),
  }),
});

export const { useListConversationsQuery, useGetConversationQuery, useConversationActionMutation, useSendAnalystMessageMutation } =
  consoleApi;

/** Mensagem de erro legível de uma resposta do RTK Query. */
export function apiErrorMessage(error: unknown): string {
  const data = (error as { data?: { error?: string } } | undefined)?.data;
  return data?.error ?? "Algo deu errado. Tente de novo.";
}
