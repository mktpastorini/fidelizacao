-- Adiciona 'DELIVERY' ao tipo de pedido, se ainda não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DELIVERY' AND enumtypid = 'public.order_type_enum'::regtype) THEN
        ALTER TYPE public.order_type_enum ADD VALUE 'DELIVERY';
    END IF;
END
$$;

-- Cria um novo tipo para os status de entrega, se ainda não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status_enum') THEN
        CREATE TYPE public.delivery_status_enum AS ENUM (
            'awaiting_confirmation',
            'in_preparation',
            'ready_for_delivery',
            'out_for_delivery',
            'delivered',
            'cancelled'
        );
    END IF;
END
$$;

-- Adiciona a nova coluna de status de entrega à tabela de pedidos, se ainda não existir
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS delivery_status public.delivery_status_enum;