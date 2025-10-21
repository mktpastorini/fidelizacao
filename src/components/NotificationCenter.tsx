import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, Phone, AlertTriangle, Cake, ShieldAlert, Loader2, Utensils, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LowStockProduct, ApprovalRequest, UserRole, ItemPedido } from "@/types/supabase";
import { Separator } from "@/components/ui/separator";
import { ApprovalRequestCard } from "./Notification/ApprovalRequestCard";
import { useSettings } from "@/contexts/SettingsContext";
import { showError, showSuccess } from "@/utils/toast";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type BirthdayClient = {
// ... (restante do arquivo permanece o mesmo)