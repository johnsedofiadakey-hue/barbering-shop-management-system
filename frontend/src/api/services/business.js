import api from '@api';
import { ENDPOINTS } from '@api/endpoints';

export async function getShopSettings() {
  const { data } = await api.instance.get(ENDPOINTS.business.shop);
  return data;
}

export async function updateShopSettings(patchData) {
  const { data } = await api.instance.patch(ENDPOINTS.business.shop, patchData);
  return data;
}

export async function getPortfolio() {
  const { data } = await api.instance.get(ENDPOINTS.business.portfolio);
  return data;
}

export async function createPortfolioItem(itemData) {
  const formData = new FormData();
  Object.entries(itemData).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') formData.append(key, value);
  });
  const { data } = await api.instance.post(ENDPOINTS.business.portfolio, formData);
  return data;
}

export async function updatePortfolioItem(itemId, patchData) {
  const formData = new FormData();
  Object.entries(patchData).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') formData.append(key, value);
  });
  const { data } = await api.instance.patch(ENDPOINTS.business.portfolioItem(itemId), formData);
  return data;
}

export async function deletePortfolioItem(itemId) {
  await api.instance.delete(ENDPOINTS.business.portfolioItem(itemId));
}

function toFormData(payload) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') formData.append(key, value);
  });
  return formData;
}

export async function getServices() {
  const { data } = await api.instance.get(ENDPOINTS.admin.services);
  return data;
}

export async function createService(payload) {
  const { data } = await api.instance.post(ENDPOINTS.admin.services, toFormData(payload));
  return data;
}

export async function updateService(serviceId, payload) {
  const { data } = await api.instance.patch(ENDPOINTS.admin.service(serviceId), toFormData(payload));
  return data;
}

export async function deleteService(serviceId) {
  await api.instance.delete(ENDPOINTS.admin.service(serviceId));
}

export async function getBeforeAfter() {
  const { data } = await api.instance.get(ENDPOINTS.business.beforeAfter);
  return data;
}

export async function createBeforeAfter(payload) {
  const { data } = await api.instance.post(ENDPOINTS.business.beforeAfter, toFormData(payload));
  return data;
}

export async function deleteBeforeAfter(itemId) {
  await api.instance.delete(ENDPOINTS.business.beforeAfterItem(itemId));
}
