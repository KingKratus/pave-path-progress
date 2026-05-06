import { test, expect } from "@playwright/test";

test("homepage carrega e mostra busca", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByPlaceholder(/Duque de Caxias/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Cada rua sem asfalto/i })).toBeVisible();
});

test("navegação para Buscar funciona", async ({ page }) => {
  await page.goto("/buscar");
  await expect(page.getByRole("heading", { name: "Buscar" })).toBeVisible();
  await page.getByPlaceholder(/Cidade, rua ou bairro/i).fill("São");
  // espera debounce
  await page.waitForTimeout(500);
});

test("ranking renderiza", async ({ page }) => {
  await page.goto("/ranking");
  await expect(page.getByRole("heading", { name: /Os melhores em pavimentação/i })).toBeVisible();
});

test("auth exibe formulário", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: /Entrar/i }).first()).toBeVisible();
});

test("sobre carrega", async ({ page }) => {
  await page.goto("/sobre");
  await expect(page.getByText(/Transparência viária/i)).toBeVisible();
});
