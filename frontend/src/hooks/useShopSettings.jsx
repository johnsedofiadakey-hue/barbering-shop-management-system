import { useEffect, useState } from 'react';
import api from '@api';

const fallbackShop = { currency_symbol: 'GH₵', currency_code: 'GHS' };
let cachedShop = null;
let pendingShop = null;

function loadShop() {
  if (!pendingShop) {
    pendingShop = api.pub
      .getShopSettings()
      .then(({ shop }) => {
        cachedShop = shop;
        return shop;
      })
      .finally(() => {
        pendingShop = null;
      });
  }
  return pendingShop;
}

export function useShopSettings() {
  const [shop, setShop] = useState(cachedShop || fallbackShop);

  useEffect(() => {
    let active = true;
    loadShop()
      .then((settings) => active && setShop(settings))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return shop;
}
