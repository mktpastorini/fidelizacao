const precoUnitarioComDescontoMesa = useMemo(() => {
  if (!itemMesaToPay) return 0;
  return itemMesaToPay.subtotal / itemMesaToPay.total_quantidade;
}, [itemMesaToPay]);