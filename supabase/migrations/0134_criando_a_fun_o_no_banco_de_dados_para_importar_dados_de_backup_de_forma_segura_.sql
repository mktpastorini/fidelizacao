CREATE OR REPLACE FUNCTION public.import_backup_data(backup_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
    -- Limpa as tabelas na ordem correta para evitar erros de chave estrangeira
    -- Tabelas que são referenciadas por outras são limpas primeiro
    DELETE FROM public.itens_pedido;
    DELETE FROM public.mesa_ocupantes;
    DELETE FROM public.pedidos;
    DELETE FROM public.mesas;
    DELETE FROM public.filhos;
    DELETE FROM public.clientes;
    DELETE FROM public.produtos;
    DELETE FROM public.categorias;
    DELETE FROM public.cozinheiros;
    DELETE FROM public.message_logs;
    DELETE FROM public.message_templates;
    DELETE FROM public.approval_requests;
    DELETE FROM public.daily_visits;

    -- Insere os novos dados a partir do JSON
    INSERT INTO public.categorias (id, user_id, nome, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, value->>'nome', (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'categorias') AS value;

    INSERT INTO public.produtos (id, user_id, nome, preco, descricao, created_at, requer_preparo, tipo, categoria_id, imagem_url, estoque_atual, alerta_estoque_baixo, valor_compra, mostrar_no_menu, pontos_resgate)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, value->>'nome', (value->>'preco')::numeric, value->>'descricao', (value->>'created_at')::timestamptz, (value->>'requer_preparo')::boolean, (value->>'tipo')::produto_tipo, (value->>'categoria_id')::uuid, value->>'imagem_url', (value->>'estoque_atual')::integer, (value->>'alerta_estoque_baixo')::integer, (value->>'valor_compra')::numeric, (value->>'mostrar_no_menu')::boolean, (value->>'pontos_resgate')::integer FROM jsonb_array_elements(backup_data->'produtos') AS value;

    INSERT INTO public.clientes (id, user_id, nome, casado_com, cliente_desde, gostos, indicacoes, whatsapp, created_at, avatar_url, indicado_por_id, visitas, data_nascimento, pontos, address_street, address_number, address_neighborhood, address_city, address_zip, address_complement)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, value->>'nome', value->>'casado_com', (value->>'cliente_desde')::timestamptz, (value->'gostos')::jsonb, (value->>'indicacoes')::integer, value->>'whatsapp', (value->>'created_at')::timestamptz, value->>'avatar_url', (value->>'indicado_por_id')::uuid, (value->>'visitas')::integer, (value->>'data_nascimento')::date, (value->>'pontos')::integer, value->>'address_street', value->>'address_number', value->>'address_neighborhood', value->>'address_city', value->>'address_zip', value->>'address_complement' FROM jsonb_array_elements(backup_data->'clientes') AS value;

    INSERT INTO public.filhos (id, cliente_id, user_id, nome, idade, created_at)
    SELECT (value->>'id')::uuid, (value->>'cliente_id')::uuid, (value->>'user_id')::uuid, value->>'nome', (value->>'idade')::integer, (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'filhos') AS value;

    INSERT INTO public.mesas (id, user_id, numero, capacidade, cliente_id, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'numero')::integer, (value->>'capacidade')::integer, (value->>'cliente_id')::uuid, (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'mesas') AS value;

    INSERT INTO public.pedidos (id, user_id, mesa_id, cliente_id, status, created_at, closed_at, acompanhantes, gorjeta_valor, garcom_id, order_type, ifood_order_id, delivery_details, delivery_status)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'mesa_id')::uuid, (value->>'cliente_id')::uuid, value->>'status', (value->>'created_at')::timestamptz, (value->>'closed_at')::timestamptz, (value->'acompanhantes')::jsonb, (value->>'gorjeta_valor')::numeric, (value->>'garcom_id')::uuid, (value->>'order_type')::order_type_enum, value->>'ifood_order_id', (value->'delivery_details')::jsonb, (value->>'delivery_status')::delivery_status_enum FROM jsonb_array_elements(backup_data->'pedidos') AS value;

    INSERT INTO public.mesa_ocupantes (id, user_id, mesa_id, cliente_id, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'mesa_id')::uuid, (value->>'cliente_id')::uuid, (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'mesa_ocupantes') AS value;

    INSERT INTO public.itens_pedido (id, user_id, pedido_id, nome_produto, quantidade, preco, created_at, consumido_por_cliente_id, desconto_percentual, desconto_motivo, status, requer_preparo, updated_at, cozinheiro_id, hora_inicio_preparo, hora_entrega)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'pedido_id')::uuid, value->>'nome_produto', (value->>'quantidade')::integer, (value->>'preco')::numeric, (value->>'created_at')::timestamptz, (value->>'consumido_por_cliente_id')::uuid, (value->>'desconto_percentual')::numeric, value->>'desconto_motivo', (value->>'status')::item_pedido_status, (value->>'requer_preparo')::boolean, (value->>'updated_at')::timestamptz, (value->>'cozinheiro_id')::uuid, (value->>'hora_inicio_preparo')::timestamptz, (value->>'hora_entrega')::timestamptz FROM jsonb_array_elements(backup_data->'itens_pedido') AS value;

    INSERT INTO public.cozinheiros (id, user_id, nome, email, avatar_url, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, value->>'nome', value->>'email', value->>'avatar_url', (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'cozinheiros') AS value;

    INSERT INTO public.message_templates (id, user_id, nome, conteudo, tipo, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, value->>'nome', value->>'conteudo', (value->>'tipo')::template_type, (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'message_templates') AS value;

    INSERT INTO public.message_logs (id, user_id, cliente_id, template_id, status, trigger_event, error_message, webhook_response, created_at, delivery_status)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'cliente_id')::uuid, (value->>'template_id')::uuid, value->>'status', value->>'trigger_event', value->>'error_message', (value->'webhook_response')::jsonb, (value->>'created_at')::timestamptz, (value->>'delivery_status')::webhook_delivery_status FROM jsonb_array_elements(backup_data->'message_logs') AS value;

    INSERT INTO public.approval_requests (id, user_id, requester_role, action_type, target_id, payload, status, approved_by, approved_at, created_at, mesa_id_fk, item_pedido_id_fk)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'requester_role')::user_role, (value->>'action_type')::approval_action_type, (value->>'target_id')::uuid, (value->'payload')::jsonb, (value->>'status')::approval_status, (value->>'approved_by')::uuid, (value->>'approved_at')::timestamptz, (value->>'created_at')::timestamptz, (value->>'mesa_id_fk')::uuid, (value->>'item_pedido_id_fk')::uuid FROM jsonb_array_elements(backup_data->'approval_requests') AS value;

    INSERT INTO public.daily_visits (id, user_id, cliente_id, visit_date, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'cliente_id')::uuid, (value->>'visit_date')::date, (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'daily_visits') AS value;

END;
$$;