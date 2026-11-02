-- Antes do índice: se algum funcionário já tem mais de uma conversa aberta (a corrida que o índice
-- impede daqui em diante), mantém a atualizada por último e encerra as outras.
UPDATE `conversations` SET `status` = 'closed'
WHERE `status` != 'closed' AND `id` NOT IN (
  SELECT `id` FROM (
    SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `employee_id` ORDER BY `updated_at` DESC, `id` DESC) AS `rn`
    FROM `conversations` WHERE `status` != 'closed'
  ) WHERE `rn` = 1
);--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_one_open_idx` ON `conversations` (`employee_id`) WHERE status != 'closed';
